/**
 * Performance Monitoring Agent for TrafficLens
 * Tracks API response times, scraping duration, cache hit rates, and performance metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  percentile?: number; // p50, p95, p99
}

interface PerformanceReport {
  timestamp: string;
  period: '1h' | '24h' | '7d';
  metrics: PerformanceMetric[];
  summary: {
    avgApiResponseTime: number;
    avgScrapingTime: number;
    cacheHitRate: number;
    p95ApiResponseTime: number;
    p99ApiResponseTime: number;
  };
}

/**
 * Calculate percentiles from array of values
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Track API response times from usage logs
 */
function getAPIResponseTimes(period: '1h' | '24h' | '7d'): number[] {
  try {
    const { getDb } = require('../lib/db');
    const db = getDb();
    
    const hoursMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[period];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get response times from usage logs
    const logs = db.prepare(`
      SELECT response_time_ms
      FROM usage_logs
      WHERE created_at > ?
        AND response_time_ms IS NOT NULL
      ORDER BY created_at DESC
    `).all(since) as Array<{ response_time_ms: number }>;
    
    return logs.map(log => log.response_time_ms);
  } catch (error) {
    console.error('Error getting API response times:', error);
    return [];
  }
}

/**
 * Track scraping times from scrape_errors and traffic_latest
 */
function getScrapingTimes(period: '1h' | '24h' | '7d'): number[] {
  try {
    const { getDb } = require('../lib/db');
    const db = getDb();
    
    const hoursMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[period];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Estimate scraping time from checked_at timestamps
    // This is approximate - actual scraping time would need to be logged separately
    const results = db.prepare(`
      SELECT checked_at
      FROM traffic_latest
      WHERE checked_at > ?
      ORDER BY checked_at DESC
    `).all(since) as Array<{ checked_at: string }>;
    
    // Return empty for now - scraping time tracking would need to be added to scraper
    return [];
  } catch (error) {
    console.error('Error getting scraping times:', error);
    return [];
  }
}

/**
 * Calculate cache hit rate
 */
function getCacheHitRate(period: '1h' | '24h' | '7d'): number {
  try {
    const { getDb } = require('../lib/db');
    const db = getDb();
    
    const hoursMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[period];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get cache hits and misses from usage logs
    const stats = db.prepare(`
      SELECT 
        SUM(cache_hits) as total_hits,
        SUM(cache_misses) as total_misses
      FROM usage_logs
      WHERE created_at > ?
    `).get(since) as { total_hits: number; total_misses: number };
    
    const hits = stats.total_hits || 0;
    const misses = stats.total_misses || 0;
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  } catch (error) {
    console.error('Error calculating cache hit rate:', error);
    return 0;
  }
}

/**
 * Get database query performance
 */
function getDatabaseQueryTimes(period: '1h' | '24h' | '7d'): number[] {
  try {
    const { getDb } = require('../lib/db');
    const db = getDb();
    
    // Simple query performance test
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      db.prepare('SELECT COUNT(*) FROM traffic_latest').get();
      times.push(Date.now() - start);
    }
    
    return times;
  } catch (error) {
    console.error('Error getting database query times:', error);
    return [];
  }
}

/**
 * Generate performance metrics
 */
function generateMetrics(responseTimes: number[], cacheHitRate: number): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];
  const timestamp = new Date().toISOString();
  
  if (responseTimes.length > 0) {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p50 = calculatePercentile(responseTimes, 50);
    const p95 = calculatePercentile(responseTimes, 95);
    const p99 = calculatePercentile(responseTimes, 99);
    
    metrics.push(
      { name: 'API Response Time (avg)', value: Math.round(avg), unit: 'ms', timestamp },
      { name: 'API Response Time (p50)', value: Math.round(p50), unit: 'ms', timestamp, percentile: 50 },
      { name: 'API Response Time (p95)', value: Math.round(p95), unit: 'ms', timestamp, percentile: 95 },
      { name: 'API Response Time (p99)', value: Math.round(p99), unit: 'ms', timestamp, percentile: 99 },
    );
  }
  
  metrics.push({
    name: 'Cache Hit Rate',
    value: Math.round(cacheHitRate * 100) / 100,
    unit: '%',
    timestamp,
  });
  
  return metrics;
}

/**
 * Run performance monitoring
 */
export async function runPerformanceMonitoring(period: '1h' | '24h' | '7d' = '24h'): Promise<PerformanceReport> {
  console.log(`📊 Starting Performance Monitoring (${period})...`);
  const timestamp = new Date().toISOString();
  
  const responseTimes = getAPIResponseTimes(period);
  const scrapingTimes = getScrapingTimes(period);
  const cacheHitRate = getCacheHitRate(period);
  const dbQueryTimes = getDatabaseQueryTimes(period);
  
  const metrics = generateMetrics(responseTimes, cacheHitRate);
  
  // Add database metrics
  if (dbQueryTimes.length > 0) {
    const avgDbTime = dbQueryTimes.reduce((a, b) => a + b, 0) / dbQueryTimes.length;
    metrics.push({
      name: 'Database Query Time (avg)',
      value: Math.round(avgDbTime * 100) / 100,
      unit: 'ms',
      timestamp,
    });
  }
  
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
  const avgScrapingTime = scrapingTimes.length > 0
    ? scrapingTimes.reduce((a, b) => a + b, 0) / scrapingTimes.length
    : 0;
  const p95ResponseTime = responseTimes.length > 0
    ? calculatePercentile(responseTimes, 95)
    : 0;
  const p99ResponseTime = responseTimes.length > 0
    ? calculatePercentile(responseTimes, 99)
    : 0;
  
  const report: PerformanceReport = {
    timestamp,
    period,
    metrics,
    summary: {
      avgApiResponseTime: Math.round(avgResponseTime),
      avgScrapingTime: Math.round(avgScrapingTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      p95ApiResponseTime: Math.round(p95ResponseTime),
      p99ApiResponseTime: Math.round(p99ResponseTime),
    },
  };
  
  console.log('\n📊 Performance Report:');
  console.log(`Period: ${period}`);
  console.log(`Avg API Response Time: ${report.summary.avgApiResponseTime}ms`);
  console.log(`P95 API Response Time: ${report.summary.p95ApiResponseTime}ms`);
  console.log(`P99 API Response Time: ${report.summary.p99ApiResponseTime}ms`);
  console.log(`Cache Hit Rate: ${report.summary.cacheHitRate}%`);
  console.log(`Avg Scraping Time: ${report.summary.avgScrapingTime}ms`);
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  const period = (process.argv[2] as '1h' | '24h' | '7d') || '24h';
  runPerformanceMonitoring(period)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Performance monitoring failed:', error);
      process.exit(1);
    });
}

