/**
 * API route for bulk traffic checking
 * POST /api/traffic
 * 
 * Returns cached results immediately, then scrapes missing domains in background
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDomains, chunkArray } from '@/lib/domain-utils';
import { scrapeTrafficData } from '@/lib/scraper';
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
  getCurrentMonth
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
 * Rate limiting: delay between batches (in milliseconds)
 */
const BATCH_DELAY_MS = 2000;

/**
 * Number of parallel batches to process
 */
const PARALLEL_BATCHES = 5;

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
    
    // Split into batches of 10 (Traffic.cv limit)
    const batches = chunkArray(cacheMisses, 10);
    const allResults: TrafficData[] = [];

    const batchProcessor = async (batch: string[], batchIndex: number) => {
      console.log(`[Background] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} domains)`);
      try {
        const batchResults = await scrapeTrafficData(batch, false);
        
        // Store results in database
        for (const result of batchResults) {
          if (!result.error) {
            // Store current month data
            storeTrafficData(result);
            
            // Store historical months if available
            if ('historicalMonths' in result && result.historicalMonths && Array.isArray(result.historicalMonths)) {
              storeHistoricalTrafficData(result.domain, result.historicalMonths, result);
            }
          }
        }
        
        return {
          success: true,
          results: batchResults,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Background] Batch ${batchIndex + 1} error:`, errorMsg);
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
      const mockResults: TrafficData[] = domains.map((domain, index) => ({
        domain,
        monthlyVisits: Math.floor(Math.random() * 1000000),
        avgSessionDuration: '00:02:30',
        avgSessionDurationSeconds: 150,
        bounceRate: Math.random() * 100,
        pagesPerVisit: Math.random() * 5 + 1,
        checkedAt: new Date().toISOString(),
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
      // Check database for fresh data
      // SimilarWeb releases monthly data by the 10th of following month (+ 2-day buffer)
      // Before 12th: Previous month's data is still valid
      // On/after 12th: Current month's data should be available
      const dbCached = getLatestTrafficDataBatch(domains);
      // Filter to only fresh data based on SimilarWeb's update schedule
      cached = new Map<string, TrafficData>();
      for (const [domain, data] of dbCached.entries()) {
        // Check if data is fresh (isDataFresh handles www. variations internally)
        // Also accept 0 traffic results (they're valid and don't need re-scraping)
        if (isDataFresh(data.domain || domain, 30) || data.monthlyVisits === 0) {
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

    // For cache misses, return placeholders IMMEDIATELY and scrape in background
    // This ensures instant response for cached data - NO BLOCKING on scraping
    const placeholderResults: TrafficData[] = [];
    
    // Create placeholders for ALL cache misses - no blocking scrape
    for (const domain of cacheMisses) {
      placeholderResults.push({
        domain,
        monthlyVisits: null,
        avgSessionDuration: null,
        avgSessionDurationSeconds: null,
        bounceRate: null,
        pagesPerVisit: null,
        checkedAt: null,
        error: 'Scraping in background...',
      });
    }

    // Combine cached + placeholders
    const immediateResults = [...cachedResults, ...placeholderResults];

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
    if (cacheMisses.length > 0) {
      console.log(`[API] Returning ${cacheHits} cached results immediately, ${cacheMisses.length} domains will scrape in background`);
      // Don't await - let it run in background
      scrapeInBackground(cacheMisses, domainOrderMap, originalDomainMap).catch(err => {
        console.error('[Background] Failed to start background scraping:', err);
      });
    } else {
      console.log(`[API] All ${cacheHits} domains served from cache - instant response`);
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
        backgroundScraping: cacheMisses.length > 0,
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
