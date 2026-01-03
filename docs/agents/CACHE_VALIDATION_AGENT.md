# Cache Validation Agent

## Overview
Tests cache hit/miss logic, freshness rules, consistency, and ensures cache works correctly.

## Purpose
Ensure cache functionality is working as expected and optimize cache strategy.

## What It Does

### Validation Tests

1. **Cache Hit Logic**
   - Verifies cached data returns quickly (< 100ms)
   - Tests cache lookup functionality
   - Validates response time

2. **Cache Freshness Rules**
   - Tests `isDataFresh()` logic
   - Validates 30-day freshness window
   - Checks stale data detection

3. **Zero Traffic Caching**
   - Ensures 0 traffic results are cached
   - Verifies 0 traffic returns correctly
   - Tests zero traffic lookup

4. **WWW Variations Handling**
   - Tests www. and non-www. matching
   - Verifies consistent results
   - Validates domain normalization in cache

5. **Cache Data Consistency**
   - Checks for data integrity
   - Validates timestamps
   - Ensures no negative values

## Usage

### Run Locally
```bash
npm run cache:validate
```

### Programmatic Usage
```typescript
import { runCacheValidation } from './scripts/cache-validation-agent';

const report = await runCacheValidation();
console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
```

## Output

### Validation Report
- Total tests
- Passed/failed counts
- Individual test results
- Error details
- Exit code: 0 (all passed) or 1 (failed)

## Examples

### All Tests Passed
```
📊 Cache Validation Report:
Total Tests: 5
Passed: 5
Failed: 0
✅ Cache Hit Logic (12ms)
✅ Cache Freshness Rules
✅ Zero Traffic Caching
✅ WWW Variations Handling
✅ Cache Data Consistency
```

### Some Tests Failed
```
📊 Cache Validation Report:
Total Tests: 5
Passed: 3
Failed: 2
✅ Cache Hit Logic (12ms)
✅ Cache Freshness Rules
❌ Zero Traffic Caching
   Error: Zero traffic domain not found in cache
✅ WWW Variations Handling
❌ Cache Data Consistency
   Error: Negative visits for domain: example.com
```

## Test Details

### Cache Hit Logic Test
- Gets a cached domain from database
- Tests lookup performance
- Validates response time < 100ms
- Ensures data is returned correctly

### Cache Freshness Test
- Tests fresh data (< 30 days) marked as fresh
- Tests stale data (> 35 days) marked as stale
- Validates `isDataFresh()` function

### Zero Traffic Caching Test
- Finds domain with 0 traffic in cache
- Verifies 0 traffic results are cached
- Tests lookup returns correct value (0)

### WWW Variations Test
- Tests www.example.com and example.com
- Verifies both return same cached data
- Validates domain normalization

### Consistency Test
- Checks for data integrity issues
- Validates timestamps
- Ensures no negative values
- Checks for empty domains

## Integration with Other Agents
- Used by **Performance Monitoring Agent** for cache metrics
- Feeds into **Data Quality Agent** for cache data validation
- Informs **API Health Agent** about cache performance

## Best Practices
1. Run regularly (daily or weekly)
2. Test with various domain formats
3. Validate after cache logic changes
4. Monitor cache hit rates over time
5. Test edge cases (0 traffic, www. variations)

## Cache Rules Validated

1. **Freshness**: Data < 30 days is considered fresh
2. **Performance**: Cache lookups should be < 100ms
3. **Zero Traffic**: 0 traffic results are cached (not errors)
4. **WWW Variations**: www. and non-www. return same data
5. **Consistency**: Cached data is valid and consistent

---

*Part of Phase 3: Nice to Have Agents*

