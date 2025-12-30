/**
 * Simple in-memory cache for traffic data
 * Keyed by domain + month to avoid repeated runs
 */

import { TrafficData } from '@/types';

interface CacheEntry {
  data: TrafficData;
  timestamp: number;
  month: string; // YYYY-MM format
}

class TrafficCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_DAYS = 30; // Cache for 30 days

  /**
   * Generates cache key from domain and current month
   */
  private getCacheKey(domain: string): string {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${domain}:${month}`;
  }

  /**
   * Gets cached data for a domain if available and not expired
   */
  get(domain: string): TrafficData | null {
    const key = this.getCacheKey(domain);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    const ageDays = (now - entry.timestamp) / (1000 * 60 * 60 * 24);

    if (ageDays > this.TTL_DAYS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sets cached data for a domain
   */
  set(domain: string, data: TrafficData): void {
    const key = this.getCacheKey(domain);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      month,
    });
  }

  /**
   * Gets multiple cached entries
   */
  getBatch(domains: string[]): Map<string, TrafficData> {
    const results = new Map<string, TrafficData>();

    for (const domain of domains) {
      const cached = this.get(domain);
      if (cached) {
        results.set(domain, cached);
      }
    }

    return results;
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   */
  getStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}

// Singleton instance
export const trafficCache = new TrafficCache();

