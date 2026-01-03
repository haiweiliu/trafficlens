/**
 * API Health Agent for TrafficLens
 * Continuously monitors API endpoints, tests workflows, and tracks availability
 */

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface HealthReport {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Test 1: API Endpoint Availability
 */
async function checkAPIAvailability(): Promise<HealthCheck> {
  const name = 'API Endpoint Availability';
  try {
    const startTime = Date.now();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/traffic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: ['google.com'] }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name,
        status: response.status >= 500 ? 'unhealthy' : 'degraded',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return {
        name,
        status: 'degraded',
        responseTime,
        error: 'Invalid response format',
      };
    }
    
    return {
      name,
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 2: Database Connectivity
 */
async function checkDatabaseConnectivity(): Promise<HealthCheck> {
  const name = 'Database Connectivity';
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    const startTime = Date.now();
    // Simple query to test connectivity
    const result = db.prepare('SELECT 1 as test').get();
    const responseTime = Date.now() - startTime;
    
    if (!result || (result as any).test !== 1) {
      return {
        name,
        status: 'unhealthy',
        responseTime,
        error: 'Database query returned unexpected result',
      };
    }
    
    return {
      name,
      status: responseTime > 100 ? 'degraded' : 'healthy',
      responseTime,
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 3: External Service Health (traffic.cv)
 */
async function checkExternalServiceHealth(): Promise<HealthCheck> {
  const name = 'External Service (traffic.cv)';
  try {
    const startTime = Date.now();
    const response = await fetch('https://traffic.cv/bulk?domains=google.com', {
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name,
        status: response.status >= 500 ? 'unhealthy' : 'degraded',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const text = await response.text();
    if (!text || text.length < 100) {
      return {
        name,
        status: 'degraded',
        responseTime,
        error: 'Response too short or empty',
      };
    }
    
    return {
      name,
      status: responseTime > 10000 ? 'degraded' : 'healthy',
      responseTime,
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 4: Update Endpoint Health
 */
async function checkUpdateEndpoint(): Promise<HealthCheck> {
  const name = 'Update Endpoint';
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/api/traffic/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: ['google.com'] }),
      signal: AbortSignal.timeout(10000),
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name,
        status: response.status >= 500 ? 'unhealthy' : 'degraded',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return {
        name,
        status: 'degraded',
        responseTime,
        error: 'Invalid response format',
      };
    }
    
    return {
      name,
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 5: Error Rate Tracking
 */
async function checkErrorRates(): Promise<HealthCheck> {
  const name = 'Error Rate';
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    // Check recent scrape errors from database
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const errorCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM scrape_errors 
      WHERE created_at > ?
    `).get(last24Hours) as { count: number };
    
    const totalScrapes = db.prepare(`
      SELECT COUNT(*) as count 
      FROM traffic_latest 
      WHERE checked_at > ?
    `).get(last24Hours) as { count: number };
    
    const errorRate = totalScrapes.count > 0 
      ? (errorCount.count / totalScrapes.count) * 100 
      : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 10) status = 'unhealthy';
    else if (errorRate > 5) status = 'degraded';
    
    return {
      name,
      status,
      details: {
        errorCount: errorCount.count,
        totalScrapes: totalScrapes.count,
        errorRate: errorRate.toFixed(2) + '%',
      },
    };
  } catch (error) {
    return {
      name,
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthReport> {
  console.log('🏥 Starting API Health Checks...');
  const timestamp = new Date().toISOString();
  
  const checks: HealthCheck[] = await Promise.all([
    checkAPIAvailability(),
    checkDatabaseConnectivity(),
    checkExternalServiceHealth(),
    checkUpdateEndpoint(),
    checkErrorRates(),
  ]);
  
  const healthy = checks.filter(c => c.status === 'healthy').length;
  const degraded = checks.filter(c => c.status === 'degraded').length;
  const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthy > 0) overallStatus = 'unhealthy';
  else if (degraded > 0) overallStatus = 'degraded';
  
  const report: HealthReport = {
    timestamp,
    overallStatus,
    checks,
    summary: {
      total: checks.length,
      healthy,
      degraded,
      unhealthy,
    },
  };
  
  console.log('\n📊 Health Report:');
  console.log(`Overall Status: ${overallStatus.toUpperCase()}`);
  console.log(`Healthy: ${healthy}/${checks.length}`);
  console.log(`Degraded: ${degraded}/${checks.length}`);
  console.log(`Unhealthy: ${unhealthy}/${checks.length}`);
  
  for (const check of checks) {
    const icon = check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
    const time = check.responseTime ? ` (${check.responseTime}ms)` : '';
    console.log(`${icon} ${check.name}${time}`);
    if (check.error) {
      console.log(`   Error: ${check.error}`);
    }
  }
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  runHealthChecks()
    .then(report => {
      process.exit(report.overallStatus === 'unhealthy' ? 1 : 0);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

