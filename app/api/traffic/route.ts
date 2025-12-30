/**
 * API route for bulk traffic checking
 * POST /api/traffic
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDomains, chunkArray } from '@/lib/domain-utils';
import { scrapeTrafficData } from '@/lib/scraper';
import { TrafficData } from '@/types';
import { trafficCache } from '@/lib/cache';
import { 
  getLatestTrafficDataBatch, 
  storeTrafficData, 
  isDataFresh,
  getHistoricalData,
  calculateTrends 
} from '@/lib/db';

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
  };
}

/**
 * Rate limiting: delay between batches (in milliseconds)
 */
const BATCH_DELAY_MS = 3000; // 3 seconds between batches (reduced for parallel processing)

/**
 * Parallel processing: how many batches to process simultaneously
 * 
 * Resource usage per batch:
 * - Memory: ~150-300 MB per browser instance
 * - CPU: Moderate (single-threaded JS, but parallel processes)
 * 
 * Recommended values:
 * - 3: Best speed, requires 1-2 GB RAM, 2 vCPU (Vercel Pro, Railway)
 * - 2: Good balance, requires 600-800 MB RAM, 1-2 vCPU (Railway, Render)
 * - 1: Sequential (slowest), requires 300-400 MB RAM, 1 vCPU (Free tiers)
 */
const PARALLEL_BATCHES = 3; // Process 3 batches at a time (30 domains simultaneously)

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BatchResult {
  success: boolean;
  results?: TrafficData[];
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

    // Normalize domains
    const normalized = normalizeDomains(rawDomains);
    const domains = normalized.map(d => d.domain);

    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No valid domains found' },
        { status: 400 }
      );
    }

    // Check database first (monthly cache - SimilarWeb updates monthly)
    let cached: Map<string, TrafficData>;
    if (bypassCache) {
      cached = new Map<string, TrafficData>();
    } else {
      // Check database for fresh data (current month, checked within 30 days)
      const dbCached = getLatestTrafficDataBatch(domains);
      // Filter to only fresh data (current month)
      cached = new Map<string, TrafficData>();
      for (const [domain, data] of dbCached.entries()) {
        if (isDataFresh(domain, 30)) {
          cached.set(domain, data);
        }
      }
      // Fallback to in-memory cache for backward compatibility
      const memoryCached = trafficCache.getBatch(domains);
      for (const [domain, data] of memoryCached.entries()) {
        if (!cached.has(domain)) {
          cached.set(domain, data);
        }
      }
    }
    
    const cacheHits = cached.size;
    const cacheMisses = domains.filter(d => !cached.has(d));

    // Split into batches of 10 (Traffic.cv limit)
    const batches = chunkArray(cacheMisses, 10);
    const allResults: TrafficData[] = [];
    const errors: string[] = [];

    // Process batches in parallel (3 at a time)
    const batchProcessor = async (batch: string[], batchIndex: number) => {
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} domains)`);

      try {
        // Scrape this batch (runs in parallel with other batches)
        const batchResults = await scrapeTrafficData(batch, dryRun);

        // Ensure we have results for all domains in the batch
        const foundDomains = new Set(batchResults.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
        const missingDomains = batch.filter(d => {
          const dNorm = d.toLowerCase().replace(/^www\./, '');
          return !foundDomains.has(dNorm);
        });

        // Store results in database and in-memory cache
        for (const result of batchResults) {
          if (!result.error) {
            const resultWithTimestamp = {
              ...result,
              checkedAt: result.checkedAt || new Date().toISOString(),
            };
            
            // Store in database (monthly snapshot)
            storeTrafficData(resultWithTimestamp);
            
            // Also keep in-memory cache for quick access
            trafficCache.set(result.domain, resultWithTimestamp);
          }
        }

        // Add timestamp to batch results
        const timestamp = new Date().toISOString();
        const batchResultsWithTimestamp = batchResults.map(r => ({
          ...r,
          checkedAt: r.checkedAt || timestamp,
        }));

        // Add error results for missing domains
        const missingResults: TrafficData[] = missingDomains.map(domain => ({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: timestamp,
          error: 'Domain not found in scraping results',
        }));

        return {
          success: true,
          results: [...batchResultsWithTimestamp, ...missingResults],
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        // Add error results for this batch to ensure all domains are accounted for
        const timestamp = new Date().toISOString();
        const errorResults: TrafficData[] = batch.map(domain => ({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: timestamp,
          error: errorMsg,
        }));

        return {
          success: false,
          error: errorMsg,
          results: errorResults,
        };
      }
    };

    // Process batches in parallel chunks
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
      if (result.error && !result.success) {
        errors.push(result.error);
      }
    }

    // Add cached results
    const cacheTimestamp = new Date().toISOString();
    for (const [domain, data] of cached.entries()) {
      allResults.push({
        ...data,
        checkedAt: data.checkedAt || cacheTimestamp,
      });
    }

    // Sort results to match original domain order
    const domainOrder = new Map(domains.map((d, i) => [d, i]));
    allResults.sort((a, b) => {
      const orderA = domainOrder.get(a.domain) ?? Infinity;
      const orderB = domainOrder.get(b.domain) ?? Infinity;
      return orderA - orderB;
    });

    // Add timestamp to all results
    const finalTimestamp = new Date().toISOString();
    const resultsWithTimestamp = allResults.map(result => ({
      ...result,
      checkedAt: result.checkedAt || finalTimestamp,
    }));

    const response: TrafficResponse = {
      results: resultsWithTimestamp,
      metadata: {
        totalDomains: domains.length,
        batchesProcessed: batches.length,
        cacheHits,
        cacheMisses: cacheMisses.length,
        errors,
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

