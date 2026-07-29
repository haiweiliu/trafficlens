/**
 * API route for bulk traffic checking
 * POST /api/traffic
 * 
 * Returns cached results immediately, then scrapes missing domains in background
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDomains, chunkArray } from '@/lib/domain-utils';
import { scrapeTrafficData } from '@/lib/scraper';
import { fetchTrafficCvBatch, isCompleteTrafficResult } from '@/lib/trafficcv-fetch';
import { retryScrapeTrafficData, backgroundRetryFailedDomains } from '@/lib/retry-scraper';
import { TrafficData } from '@/types';
import { trafficCache } from '@/lib/cache';
import {
  getLatestTrafficDataBatch,
  storeTrafficData,
  storeHistoricalTrafficData,
  isDataFresh,
  getHistoricalData,
  calculateTrends,
  getCurrentMonth,
  storeTrafficError,
} from '@/lib/db';
import { logUsage } from '@/lib/usage-tracker';

export const maxDuration = 300; // 5 minutes for Vercel

interface TrafficRequest {
  domains: string[];
  dryRun?: boolean;
  bypassCache?: boolean;
}

interface TrafficResponse {
  results: TrafficData[];
  metadata: {
    totalDomains: number;
    batchesProcessed: number;
    cacheHits: number;
    cacheMisses: number;
    errors: string[];
    backgroundScraping?: boolean; // Indicates if background scraping is happening
  };
}

/**
 * Rate limiting: delay between batch *groups* (parallel processor chunks).
 * Env TL_BATCH_DELAY_MS — on CPX31 / scraper-HQ raise to 15000–20000 if CPU pegged at 400%.
 */
const BATCH_DELAY_MS = Math.max(
  5000,
  parseInt(process.env.TL_BATCH_DELAY_MS || '12000', 10)
);

/**
 * Domains per Playwright scrape call (bulk traffic.cv URL). 2–3 is efficient; 1 lowers peak RAM/CPU per step.
 * Env TL_BG_DOMAIN_CHUNK
 */
const BG_DOMAIN_CHUNK = 10;

/**
 * Extra pause after each background batch (ms). Env TL_INTER_BATCH_SLEEP_MS — use 3000–8000 on busy VPS.
 */
const INTER_BATCH_SLEEP_MS = Math.max(
  0,
  parseInt(process.env.TL_INTER_BATCH_SLEEP_MS || '4000', 10)
);

/**
 * Parallel Playwright batches. Default 1 on Railway to avoid OOM killing the whole process.
 * Override with TL_PARALLEL_BATCHES (e.g. 3 on ScrapeHQ / CPX31).
 */
const PARALLEL_BATCHES = Math.max(
  1,
  parseInt(
    process.env.TL_PARALLEL_BATCHES ||
      (process.env.RAILWAY_ENVIRONMENT ? '1' : '3'),
    10
  )
);

/** Flight-chunk fetch is fast enough to block for typical UI batches (≤10 domains). */
const SYNC_SCRAPE_LIMIT = Math.min(
  10,
  Math.max(1, parseInt(process.env.TL_SYNC_SCRAPE_LIMIT || '10', 10))
);

function enqueueBackgroundScrape(task: () => Promise<void>): void {
  // Parallel execution pool (Bypassed serialization for Extreme Acceleration)
  task().catch((err) => {
    console.error('[Background Task] Unhandled:', err);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BatchResult {
  success: boolean;
  results: TrafficData[];
  error?: string;
}

/**
 * Process batches in parallel with a limit
 */
async function processBatchesInParallel<T>(
  batches: T[][],
  processor: (batch: T[], index: number) => Promise<BatchResult>,
  parallelLimit: number
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  // Process batches in chunks of parallelLimit
  for (let i = 0; i < batches.length; i += parallelLimit) {
    const chunk = batches.slice(i, i + parallelLimit);
    const chunkPromises = chunk.map((batch, chunkIndex) => {
      const batchIndex = i + chunkIndex;
      return processor(batch, batchIndex).catch(error => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMsg,
          results: []
        };
      });
    });

    // Wait for all batches in this chunk to complete
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // Small delay between chunks to avoid overwhelming the server
    if (i + parallelLimit < batches.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

/**
 * Background scraping function (doesn't block response)
 */
async function scrapeInBackground(
  cacheMisses: string[],
  domainOrderMap: Map<string, number>,
  originalDomainMap: Map<string, string>
): Promise<void> {
  try {
    if (cacheMisses.length === 0) return;

    console.log(`[Background] Starting scrape for ${cacheMisses.length} domains...`);

    const batches = chunkArray(cacheMisses, BG_DOMAIN_CHUNK);
    const allResults: TrafficData[] = [];

    const batchProcessor = async (batch: string[], batchIndex: number) => {
      console.log(`[Background] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} domains)`);
      try {
        const batchResults = await scrapeTrafficData(batch, false, false);

        // Store results in database (including errors)
        for (const result of batchResults) {
          // Verify we have minimal valid data to store
          if (result.domain) {
            storeTrafficData(result);

            // Store historical months if available
            if (!result.error && 'historicalMonths' in result && result.historicalMonths && Array.isArray(result.historicalMonths)) {
              storeHistoricalTrafficData(result.domain, result.historicalMonths, result);
            }
          }
        }

        if (INTER_BATCH_SLEEP_MS > 0) {
          await sleep(INTER_BATCH_SLEEP_MS);
        }

        return {
          success: true,
          results: batchResults,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Background] Batch ${batchIndex + 1} error:`, errorMsg);

        // Critical: Store error state for all domains in this batch so frontend stops polling
        try {
          for (const domain of batch) {
            storeTrafficError(domain, `Batch failed: ${errorMsg}`);
          }
        } catch (dbError) {
          console.error('[Background] Failed to store batch error:', dbError);
        }

        return {
          success: false,
          error: errorMsg,
          results: [],
        };
      }
    };

    // Process batches in parallel
    const parallelResults = await processBatchesInParallel(
      batches,
      batchProcessor,
      PARALLEL_BATCHES
    );

    // Collect all results
    for (const result of parallelResults) {
      if (result.results) {
        allResults.push(...result.results);
      }
    }

    // Retry failed domains in background
    const failedDomains = allResults
      .filter(r => r.error)
      .map(r => r.domain);

    if (failedDomains.length > 0) {
      console.log(`[Background] Retrying ${failedDomains.length} failed domains...`);
      backgroundRetryFailedDomains(failedDomains);
    }

    console.log(`[Background] Completed scraping ${allResults.length} domains`);
  } catch (error) {
    console.error('[Background] Scraping error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TrafficRequest = await request.json();
    const { domains: rawDomains, dryRun = false, bypassCache = false } = body;

    if (!rawDomains || !Array.isArray(rawDomains) || rawDomains.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: domains array required' },
        { status: 400 }
      );
    }

    // Normalize domains but preserve original order mapping
    const normalized = normalizeDomains(rawDomains);
    const domains = normalized.map(d => d.domain);

    // Create mapping: normalized domain -> original input order index
    // Also create reverse mapping for www. variations
    const domainOrderMap = new Map<string, number>(); // normalized domain -> original index
    const originalDomainMap = new Map<string, string>(); // normalized domain -> original domain string

    normalized.forEach((item, index) => {
      const normDomain = item.domain.toLowerCase().trim();
      const withoutWww = normDomain.replace(/^www\./, '');
      const withWww = `www.${withoutWww}`;

      // Map both www. and non-www. variations to the same original index
      domainOrderMap.set(withoutWww, index);
      domainOrderMap.set(withWww, index);

      // Store original domain for reference
      originalDomainMap.set(withoutWww, item.original);
      originalDomainMap.set(withWww, item.original);
    });

    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No valid domains found' },
        { status: 400 }
      );
    }

    // DRY RUN: Return mock data immediately
    if (dryRun) {
      const mockResults: TrafficData[] = domains.map((domain) => ({
        domain,
        monthlyVisits: Math.floor(Math.random() * 1000000),
        avgSessionDuration: '00:02:30',
        avgSessionDurationSeconds: 150,
        bounceRate: Math.random() * 100,
        pagesPerVisit: Math.random() * 5 + 1,
        checkedAt: new Date().toISOString(),
        trafficSources: null,
        error: null,
      }));

      return NextResponse.json({
        results: mockResults,
        metadata: {
          totalDomains: domains.length,
          batchesProcessed: 0,
          cacheHits: 0,
          cacheMisses: domains.length,
          errors: [],
        },
      });
    }

    // Check database first (monthly cache - SimilarWeb updates by 10th of following month)
    let cached: Map<string, TrafficData>;
    if (bypassCache) {
      cached = new Map<string, TrafficData>();
    } else {
      const dbCached = getLatestTrafficDataBatch(domains);
      cached = new Map<string, TrafficData>();
      for (const [domain, data] of dbCached.entries()) {
        // Reject partial cache rows (duration-only scrapes with null visits)
        if (
          data.monthlyVisits !== null &&
          data.monthlyVisits !== undefined &&
          isDataFresh(data.domain || domain, 30)
        ) {
          cached.set(domain, data);
        }
      }
      // Fallback to in-memory cache for backward compatibility
      const memoryCached = trafficCache.getBatch(domains);
      for (const [domain, data] of memoryCached.entries()) {
        if (!cached.has(domain)) {
          // Ensure avgSessionDuration is formatted if we have seconds
          const formattedData: TrafficData = { ...data };
          if (!formattedData.avgSessionDuration && formattedData.avgSessionDurationSeconds !== null) {
            // Convert seconds to formatted string (HH:MM:SS)
            const seconds = formattedData.avgSessionDurationSeconds;
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            formattedData.avgSessionDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
          cached.set(domain, formattedData);
        }
      }
    }

    const cacheHits = cached.size;
    const cacheMisses = domains.filter(d => !cached.has(d));

    let freshResults: TrafficData[] = [];
    let backgroundScraping = false;

    // Sync path: flight-chunk fetch returns in seconds — no placeholder polling loop
    if (cacheMisses.length > 0 && cacheMisses.length <= SYNC_SCRAPE_LIMIT) {
      console.log(`[API] Sync scrape for ${cacheMisses.length} cache miss(es)`);
      const batches = chunkArray(cacheMisses, 10);
      for (const batch of batches) {
        let batchResults = await fetchTrafficCvBatch(batch);
        const completeRate =
          batchResults.filter(isCompleteTrafficResult).length / batch.length;
        if (completeRate < 0.5) {
          batchResults = await scrapeTrafficData(batch, false);
        }
        for (const result of batchResults) {
          if (result.domain) {
            if (isCompleteTrafficResult(result)) {
              storeTrafficData(result);
              if (
                !result.error &&
                'historicalMonths' in result &&
                Array.isArray(result.historicalMonths)
              ) {
                storeHistoricalTrafficData(result.domain, result.historicalMonths, result);
              }
            } else if (result.error) {
              storeTrafficError(result.domain, result.error);
            }
          }
          freshResults.push(result);
        }
      }
    }

    // Prepare cached results for immediate return
    const cachedResults: TrafficData[] = [];
    for (const [domain, data] of cached.entries()) {
      // Ensure avgSessionDuration is formatted if we have seconds but no formatted string
      let formattedDuration = data.avgSessionDuration;
      if (!formattedDuration && data.avgSessionDurationSeconds !== null && data.avgSessionDurationSeconds !== undefined) {
        // Convert seconds to formatted string (HH:MM:SS)
        const seconds = data.avgSessionDurationSeconds;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        formattedDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      cachedResults.push({
        ...data,
        avgSessionDuration: formattedDuration,
        checkedAt: data.checkedAt,
      });
    }

    // Placeholders only when we defer to background (large batches)
    const placeholderResults: TrafficData[] = [];
    if (cacheMisses.length > freshResults.length) {
      const freshDomains = new Set(
        freshResults.map((r) => r.domain.toLowerCase().replace(/^www\./, ''))
      );
      for (const domain of cacheMisses) {
        const norm = domain.toLowerCase().replace(/^www\./, '');
        if (freshDomains.has(norm)) continue;
        placeholderResults.push({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: null,
          trafficSources: null,
          error: 'Scraping in background...',
        });
      }
      backgroundScraping = placeholderResults.length > 0;
    }

    // Combine cached + sync-scraped + placeholders
    const immediateResults = [...cachedResults, ...freshResults, ...placeholderResults];

    // Sort results to match original domain order (preserves Google Sheet/CSV order)
    immediateResults.sort((a, b) => {
      // Normalize result domains for matching
      const aNorm = a.domain.toLowerCase().trim().replace(/^www\./, '');
      const bNorm = b.domain.toLowerCase().trim().replace(/^www\./, '');

      // Get original order index (handles www. variations)
      const orderA = domainOrderMap.get(aNorm) ?? domainOrderMap.get(`www.${aNorm}`) ?? Infinity;
      const orderB = domainOrderMap.get(bNorm) ?? domainOrderMap.get(`www.${bNorm}`) ?? Infinity;

      return orderA - orderB;
    });

    // Start background scraping for ALL cache misses (non-blocking)
    // This is fire-and-forget - response returns immediately
    if (backgroundScraping) {
      const deferred = cacheMisses.filter((domain) =>
        placeholderResults.some((p) => p.domain === domain)
      );
      console.log(
        `[API] ${cacheHits} cached, ${freshResults.length} sync-scraped, ${deferred.length} deferred to background`
      );
      enqueueBackgroundScrape(() => scrapeInBackground(deferred, domainOrderMap, originalDomainMap));
    } else if (cacheMisses.length === 0) {
      console.log(`[API] All ${cacheHits} domains served from cache - instant response`);
    } else {
      console.log(`[API] Sync scrape completed for ${freshResults.length} domain(s)`);
    }

    // Log usage statistics (only for cached results for now)
    try {
      const totalVisits = cachedResults
        .filter(r => r.monthlyVisits !== null && r.monthlyVisits !== undefined)
        .reduce((sum, r) => sum + (r.monthlyVisits || 0), 0);

      logUsage({
        rowsProcessed: domains.length,
        errors: 0, // Will be updated when background scraping completes
        totalVisits,
        cacheHits,
        cacheMisses: cacheMisses.length,
      });
    } catch (error) {
      // Don't fail the request if usage logging fails
      console.error('Failed to log usage:', error);
    }

    // Return immediate results (cached + placeholders)
    const response: TrafficResponse = {
      results: immediateResults,
      metadata: {
        totalDomains: domains.length,
        batchesProcessed: Math.ceil(cacheMisses.length / 10),
        cacheHits,
        cacheMisses: cacheMisses.length,
        errors: [],
        backgroundScraping,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
