# Performance Monitoring Agent

## Overview
Tracks API response times, scraping duration, cache hit rates, and performance metrics over time.

## Purpose
Proactive performance optimization through data-driven insights.

## What It Does

### Metrics Tracked

1. **API Response Times**
   - Average response time
   - Percentiles (p50, p95, p99)
   - Trends over time

2. **Scraping Duration**
   - Average scraping time per domain
   - Time distribution
   - Performance trends

3. **Cache Hit Rates**
   - Percentage of requests served from cache
   - Cache efficiency metrics
   - Hit/miss ratios

4. **Database Query Performance**
   - Average query time
   - Query optimization insights

## Usage

### Run Locally
```bash
# Default: Last 24 hours
npm run performance:monitor

# Last hour
npm run performance:monitor 1h

# Last 7 days
npm run performance:monitor 7d
```

### Programmatic Usage
```typescript
import { runPerformanceMonitoring } from './scripts/performance-monitoring-agent';

const report = await runPerformanceMonitoring('24h');
console.log(`Avg API Response: ${report.summary.avgApiResponseTime}ms`);
console.log(`Cache Hit Rate: ${report.summary.cacheHitRate}%`);
```

## Output

### Performance Report
- Period (1h, 24h, 7d)
- Metrics array with values and units
- Summary statistics
- Percentile breakdowns

## Examples

### Good Performance
```
📊 Performance Report:
Period: 24h
Avg API Response Time: 234ms
P95 API Response Time: 512ms
P99 API Response Time: 890ms
Cache Hit Rate: 87.5%
Avg Scraping Time: 3456ms
```

### Degraded Performance
```
📊 Performance Report:
Period: 24h
Avg API Response Time: 5234ms ⚠️
P95 API Response Time: 12345ms ⚠️
P99 API Response Time: 23456ms ⚠️
Cache Hit Rate: 45.2% ⚠️
Avg Scraping Time: 8923ms ⚠️
```

## Metrics Explained

### Response Time Percentiles
- **p50 (Median)**: 50% of requests faster than this
- **p95**: 95% of requests faster than this
- **p99**: 99% of requests faster than this

### Cache Hit Rate
- Target: > 80%
- Good: 70-80%
- Poor: < 70%

### API Response Time Targets
- Excellent: < 500ms (p95)
- Good: 500-2000ms (p95)
- Needs improvement: > 2000ms (p95)

## Data Sources

1. **Usage Logs** (`usage_logs` table)
   - API response times
   - Cache hits/misses
   - Request counts

2. **Traffic Latest** (`traffic_latest` table)
   - Scraping timestamps (estimated)

3. **Real-time Tests**
   - Database query performance
   - Current system performance

## Integration with Other Agents
- Used by **API Health Agent** for performance baseline
- Feeds into **Code Optimization Agent** for optimization targets
- Informs **Cache Validation Agent** about cache efficiency

## Best Practices
1. Monitor trends over time (daily, weekly)
2. Set up alerts for performance degradation
3. Track percentile metrics (not just averages)
4. Compare periods (week-over-week, month-over-month)
5. Investigate spikes and anomalies
6. Use for capacity planning

## Performance Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response (p95) | < 500ms | 500-2000ms | > 2000ms |
| Cache Hit Rate | > 80% | 70-80% | < 70% |
| Scraping Time | < 5000ms | 5000-10000ms | > 10000ms |
| DB Query Time | < 50ms | 50-100ms | > 100ms |

---

*Part of Phase 2: Important Agents*

