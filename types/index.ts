/**
 * Type definitions for Traffic Bulk Extractor
 */

export interface TrafficData {
  domain: string;
  monthlyVisits: number | null;
  avgSessionDuration: string | null;
  avgSessionDurationSeconds: number | null;
  bounceRate: number | null;
  pagesPerVisit: number | null;
  checkedAt: string | null;
  error: string | null;
}

export interface TrafficResponse {
  results: TrafficData[];
  metadata: {
    totalDomains: number;
    batchesProcessed: number;
    cacheHits: number;
    cacheMisses: number;
    errors: string[];
  };
}

