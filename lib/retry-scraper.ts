/**
 * Retry scraper with exponential backoff and background retry
 */

import { scrapeTrafficData } from './scraper';
import { TrafficData } from '@/types';
import { storeTrafficData } from './db';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 5000, // 5 seconds
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry scraping with exponential backoff
 */
export async function retryScrapeTrafficData(
  domains: string[],
  options: RetryOptions = {}
): Promise<TrafficData[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${opts.maxRetries} for ${domains.length} domains (waiting ${delay}ms)...`);
        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
      }

      const results = await scrapeTrafficData(domains, false);
      
      // Check if we got results (even if some have errors or 0 traffic)
      const hasResults = results.length > 0;
      // Valid data includes 0 traffic (monthlyVisits === 0 is valid, null is not)
      const hasValidData = results.some(r => 
        !r.error && (
          r.monthlyVisits !== null || 
          r.avgSessionDuration !== null ||
          r.bounceRate !== null ||
          r.pagesPerVisit !== null
        )
      );
      
      if (hasResults && hasValidData) {
        return results;
      }

      // If last attempt, return results anyway
      if (attempt === opts.maxRetries) {
        return results;
      }

      // Continue to retry
      lastError = new Error('No valid data extracted');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === opts.maxRetries) {
        // Last attempt failed, return error results
        return domains.map(domain => ({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: null,
          error: lastError?.message || 'Unknown error',
        }));
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  return domains.map(domain => ({
    domain,
    monthlyVisits: null,
    avgSessionDuration: null,
    avgSessionDurationSeconds: null,
    bounceRate: null,
    pagesPerVisit: null,
    checkedAt: null,
    error: lastError?.message || 'Max retries exceeded',
  }));
}

/**
 * Background retry for failed domains
 * This will retry in the background and update the database when done
 */
export async function backgroundRetryFailedDomains(
  failedDomains: string[],
  onComplete?: (results: TrafficData[]) => void
): Promise<void> {
  if (failedDomains.length === 0) return;

  console.log(`🔄 Starting background retry for ${failedDomains.length} failed domains...`);

  // Run in background (don't await)
  (async () => {
    try {
      // Wait a bit longer for background retry
      await sleep(10000); // 10 seconds initial wait

      const results = await retryScrapeTrafficData(failedDomains, {
        maxRetries: 2,
        initialDelay: 10000, // 10 seconds
        maxDelay: 60000, // 60 seconds
        backoffMultiplier: 2,
      });

      // Store successful results (including 0 traffic)
      for (const result of results) {
        // Store if no error and we have any data (including 0 visits)
        if (!result.error && (
          result.monthlyVisits !== null || 
          result.avgSessionDuration !== null ||
          result.bounceRate !== null ||
          result.pagesPerVisit !== null
        )) {
          storeTrafficData(result);
          console.log(`✅ Background retry succeeded for ${result.domain} (visits: ${result.monthlyVisits ?? 'N/A'})`);
        }
      }

      if (onComplete) {
        onComplete(results);
      }
    } catch (error) {
      console.error('Background retry error:', error);
    }
  })();
}

