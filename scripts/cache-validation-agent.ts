/**
 * Cache Validation Agent for TrafficLens
 * Tests cache hit/miss logic, freshness rules, and consistency
 */

interface CacheTest {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

interface CacheValidationReport {
  timestamp: string;
  tests: CacheTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Test 1: Cache hit logic
 */
async function testCacheHitLogic(): Promise<CacheTest> {
  const name = 'Cache Hit Logic';
  try {
    const { getDb, getLatestTrafficDataBatch, isDataFresh } = await import('../lib/db');
    const db = getDb();
    
    // Get a domain that exists in cache
    const cachedDomain = db.prepare(`
      SELECT domain FROM traffic_latest 
      WHERE checked_at > datetime('now', '-25 days')
      LIMIT 1
    `).get() as { domain: string } | undefined;
    
    if (!cachedDomain) {
      return {
        name,
        passed: false,
        error: 'No cached domain found for testing',
      };
    }
    
    // Test cache lookup
    const startTime = Date.now();
    const results = getLatestTrafficDataBatch([cachedDomain.domain]);
    const responseTime = Date.now() - startTime;
    
    if (results.size === 0 || !results.has(cachedDomain.domain)) {
      return {
        name,
        passed: false,
        error: 'Cache lookup returned no results',
      };
    }
    
    // Cache should return quickly (< 100ms)
    if (responseTime > 100) {
      return {
        name,
        passed: false,
        error: `Cache lookup too slow: ${responseTime}ms (expected < 100ms)`,
        details: { responseTime },
      };
    }
    
    return {
      name,
      passed: true,
      details: { responseTime, domain: cachedDomain.domain },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 2: Cache freshness rules
 */
async function testCacheFreshness(): Promise<CacheTest> {
  const name = 'Cache Freshness Rules';
  try {
    const { getDb, isDataFresh } = await import('../lib/db');
    const db = getDb();
    
    // Test with fresh data (< 30 days)
    const freshDomain = db.prepare(`
      SELECT domain FROM traffic_latest 
      WHERE checked_at > datetime('now', '-25 days')
      LIMIT 1
    `).get() as { domain: string } | undefined;
    
    if (!freshDomain) {
      return {
        name,
        passed: false,
        error: 'No fresh domain found for testing',
      };
    }
    
    const isFresh = isDataFresh(freshDomain.domain, 30);
    if (!isFresh) {
      return {
        name,
        passed: false,
        error: 'Fresh data marked as stale',
        details: { domain: freshDomain.domain },
      };
    }
    
    // Test with stale data (> 35 days)
    const staleDomain = db.prepare(`
      SELECT domain FROM traffic_latest 
      WHERE checked_at < datetime('now', '-35 days')
      LIMIT 1
    `).get() as { domain: string } | undefined;
    
    if (staleDomain) {
      const isStale = !isDataFresh(staleDomain.domain, 30);
      if (!isStale) {
        return {
          name,
          passed: false,
          error: 'Stale data marked as fresh',
          details: { domain: staleDomain.domain },
        };
      }
    }
    
    return {
      name,
      passed: true,
      details: { freshDomain: freshDomain.domain, staleDomain: staleDomain?.domain },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 3: Zero traffic caching
 */
async function testZeroTrafficCaching(): Promise<CacheTest> {
  const name = 'Zero Traffic Caching';
  try {
    const { getDb, getLatestTrafficDataBatch } = await import('../lib/db');
    const db = getDb();
    
    // Find a domain with 0 traffic
    const zeroTrafficDomain = db.prepare(`
      SELECT domain FROM traffic_latest 
      WHERE monthly_visits = 0
      LIMIT 1
    `).get() as { domain: string } | undefined;
    
    if (!zeroTrafficDomain) {
      return {
        name,
        passed: true, // Pass if no zero traffic domains exist (not an error)
        details: { message: 'No zero traffic domains found' },
      };
    }
    
    // Test that zero traffic results are cached and returned
    const results = getLatestTrafficDataBatch([zeroTrafficDomain.domain]);
    
    if (results.size === 0 || !results.has(zeroTrafficDomain.domain)) {
      return {
        name,
        passed: false,
        error: 'Zero traffic domain not found in cache',
        details: { domain: zeroTrafficDomain.domain },
      };
    }
    
    const result = results.get(zeroTrafficDomain.domain)!;
    if (result.monthlyVisits !== 0) {
      return {
        name,
        passed: false,
        error: 'Zero traffic domain has non-zero visits',
        details: { domain: zeroTrafficDomain.domain, visits: result.monthlyVisits },
      };
    }
    
    return {
      name,
      passed: true,
      details: { domain: zeroTrafficDomain.domain },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 4: www. variations handling
 */
async function testWwwVariations(): Promise<CacheTest> {
  const name = 'WWW Variations Handling';
  try {
    const { getDb, getLatestTrafficDataBatch } = await import('../lib/db');
    const db = getDb();
    
    // Get a domain from cache
    const cachedDomain = db.prepare(`
      SELECT domain FROM traffic_latest 
      LIMIT 1
    `).get() as { domain: string } | undefined;
    
    if (!cachedDomain) {
      return {
        name,
        passed: false,
        error: 'No cached domain found for testing',
      };
    }
    
    const domain = cachedDomain.domain;
    const domainWithWww = domain.startsWith('www.') ? domain : `www.${domain}`;
    const domainWithoutWww = domain.replace(/^www\./, '');
    
    // Test lookup with www.
    const resultsWithWww = getLatestTrafficDataBatch([domainWithWww]);
    const resultsWithoutWww = getLatestTrafficDataBatch([domainWithoutWww]);
    
    // Both variations should return the same result
    if (resultsWithWww.size === 0 || resultsWithoutWww.size === 0) {
      return {
        name,
        passed: false,
        error: 'Cache lookup failed for www. variation',
        details: { domain, withWww: resultsWithWww.size > 0, withoutWww: resultsWithoutWww.size > 0 },
      };
    }
    
    // Results should match (same monthly visits)
    const visitsWithWww = resultsWithWww.get(domainWithWww)?.monthlyVisits;
    const visitsWithoutWww = resultsWithoutWww.get(domainWithoutWww)?.monthlyVisits;
    
    if (visitsWithWww !== visitsWithoutWww) {
      return {
        name,
        passed: false,
        error: 'www. and non-www. variations return different results',
        details: { domain, withWww: visitsWithWww, withoutWww: visitsWithoutWww },
      };
    }
    
    return {
      name,
      passed: true,
      details: { domain, visits: visitsWithWww },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 5: Cache data consistency
 */
async function testCacheConsistency(): Promise<CacheTest> {
  const name = 'Cache Data Consistency';
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    // Get a sample of cached data
    const cachedData = db.prepare(`
      SELECT domain, monthly_visits, checked_at
      FROM traffic_latest
      LIMIT 10
    `).all() as Array<{ domain: string; monthly_visits: number | null; checked_at: string }>;
    
    if (cachedData.length === 0) {
      return {
        name,
        passed: false,
        error: 'No cached data found',
      };
    }
    
    // Check for consistency issues
    const issues: string[] = [];
    
    for (const row of cachedData) {
      // Check for null domains
      if (!row.domain || row.domain.trim() === '') {
        issues.push(`Empty domain found`);
      }
      
      // Check for invalid timestamps
      const checkedDate = new Date(row.checked_at);
      if (isNaN(checkedDate.getTime())) {
        issues.push(`Invalid timestamp for domain: ${row.domain}`);
      }
      
      // Check for negative visits (shouldn't happen but validate)
      if (row.monthly_visits !== null && row.monthly_visits < 0) {
        issues.push(`Negative visits for domain: ${row.domain}`);
      }
    }
    
    if (issues.length > 0) {
      return {
        name,
        passed: false,
        error: `Consistency issues found: ${issues.slice(0, 3).join('; ')}`,
        details: { issues: issues.slice(0, 5) },
      };
    }
    
    return {
      name,
      passed: true,
      details: { checkedDomains: cachedData.length },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all cache validation tests
 */
export async function runCacheValidation(): Promise<CacheValidationReport> {
  console.log('🔍 Starting Cache Validation Tests...');
  const timestamp = new Date().toISOString();
  
  const tests: CacheTest[] = await Promise.all([
    testCacheHitLogic(),
    testCacheFreshness(),
    testZeroTrafficCaching(),
    testWwwVariations(),
    testCacheConsistency(),
  ]);
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  const report: CacheValidationReport = {
    timestamp,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
    },
  };
  
  console.log('\n📊 Cache Validation Report:');
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  
  for (const test of tests) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  }
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  runCacheValidation()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Cache validation failed:', error);
      process.exit(1);
    });
}

