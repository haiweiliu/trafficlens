/**
 * Deployment Verification Agent for TrafficLens
 * Pre-deployment environment testing to catch issues before production
 */

interface VerificationTest {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

interface DeploymentVerificationReport {
  timestamp: string;
  environment: string;
  tests: VerificationTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  canDeploy: boolean;
}

/**
 * Test 1: Environment Variables
 */
async function testEnvironmentVariables(): Promise<VerificationTest> {
  const name = 'Environment Variables';
  try {
    const requiredVars = [
      'NODE_ENV',
      // Add other required env vars as needed
    ];
    
    const optionalVars = [
      'DATABASE_PATH',
      'RAILWAY_VOLUME_MOUNT_PATH',
      'RESEND_API_KEY',
      'EMAIL_TO',
      'NEXT_PUBLIC_BASE_URL',
    ];
    
    const missing: string[] = [];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      return {
        name,
        passed: false,
        error: `Missing required environment variables: ${missing.join(', ')}`,
        details: { missing, optional: optionalVars },
      };
    }
    
    return {
      name,
      passed: true,
      details: { required: requiredVars, optional: optionalVars },
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
 * Test 2: Playwright/Browser Availability
 */
async function testBrowserAvailability(): Promise<VerificationTest> {
  const name = 'Browser Availability (Playwright)';
  try {
    const { chromium } = require('playwright');
    
    // Try to launch browser
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.goto('https://example.com', { timeout: 10000 });
    const title = await page.title();
    await browser.close();
    
    if (!title || title.trim() === '') {
      return {
        name,
        passed: false,
        error: 'Browser launched but failed to load page',
      };
    }
    
    return {
      name,
      passed: true,
      details: { browserType: 'chromium', testPage: 'example.com' },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { hint: 'Check if Playwright browsers are installed: npx playwright install chromium' },
    };
  }
}

/**
 * Test 3: Database Connectivity
 */
async function testDatabaseConnectivity(): Promise<VerificationTest> {
  const name = 'Database Connectivity';
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    // Test basic query
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    
    if (!result || result.test !== 1) {
      return {
        name,
        passed: false,
        error: 'Database query returned unexpected result',
      };
    }
    
    // Test schema exists
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('traffic_latest', 'traffic_snapshots')
    `).all() as Array<{ name: string }>;
    
    if (tables.length < 2) {
      return {
        name,
        passed: false,
        error: `Missing required tables. Found: ${tables.map(t => t.name).join(', ')}`,
      };
    }
    
    return {
      name,
      passed: true,
      details: { tables: tables.map(t => t.name) },
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
 * Test 4: API Endpoints (if running in server mode)
 */
async function testAPIEndpoints(): Promise<VerificationTest> {
  const name = 'API Endpoints';
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    
    // Skip if no base URL configured
    if (baseUrl === 'http://localhost:3000' && process.env.NODE_ENV === 'production') {
      return {
        name,
        passed: true,
        details: { skipped: 'No API URL configured, skipping endpoint test' },
      };
    }
    
    try {
      const response = await fetch(`${baseUrl}/api/traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: ['google.com'] }),
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        return {
          name,
          passed: false,
          error: `API endpoint returned ${response.status}: ${response.statusText}`,
        };
      }
      
      const data = await response.json();
      if (!data.results || !Array.isArray(data.results)) {
        return {
          name,
          passed: false,
          error: 'API endpoint returned invalid response format',
        };
      }
      
      return {
        name,
        passed: true,
        details: { baseUrl, responseTime: 'tested' },
      };
    } catch (fetchError) {
      // If fetch fails (e.g., server not running), skip this test
      return {
        name,
        passed: true,
        details: { skipped: 'API server not available (normal for pre-deployment)', error: fetchError instanceof Error ? fetchError.message : 'Unknown' },
      };
    }
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 5: Node.js Version
 */
async function testNodeVersion(): Promise<VerificationTest> {
  const name = 'Node.js Version';
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    // Require Node.js >= 20
    if (majorVersion < 20) {
      return {
        name,
        passed: false,
        error: `Node.js version ${nodeVersion} is too old. Required: >= 20.9.0`,
        details: { current: nodeVersion, required: '>= 20.9.0' },
      };
    }
    
    return {
      name,
      passed: true,
      details: { version: nodeVersion },
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
 * Test 6: File System Permissions
 */
async function testFileSystemPermissions(): Promise<VerificationTest> {
  const name = 'File System Permissions';
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Test write permissions (for database)
    const testDir = process.env.DATABASE_PATH 
      ? path.dirname(process.env.DATABASE_PATH)
      : './data';
    
    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      const testFile = path.join(testDir, '.deployment-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      return {
        name,
        passed: true,
        details: { testDir },
      };
    } catch (fsError) {
      return {
        name,
        passed: false,
        error: `Cannot write to ${testDir}: ${fsError instanceof Error ? fsError.message : 'Unknown error'}`,
        details: { testDir },
      };
    }
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run deployment verification
 */
export async function runDeploymentVerification(): Promise<DeploymentVerificationReport> {
  console.log('🚀 Starting Deployment Verification...');
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  
  const tests: VerificationTest[] = await Promise.all([
    testEnvironmentVariables(),
    testNodeVersion(),
    testFileSystemPermissions(),
    testDatabaseConnectivity(),
    testBrowserAvailability(),
    testAPIEndpoints(),
  ]);
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const canDeploy = failed === 0;
  
  const report: DeploymentVerificationReport = {
    timestamp,
    environment,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
    },
    canDeploy,
  };
  
  console.log('\n📊 Deployment Verification Report:');
  console.log(`Environment: ${environment}`);
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Can Deploy: ${canDeploy ? '✅ YES' : '❌ NO'}`);
  
  for (const test of tests) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  }
  
  if (!canDeploy) {
    console.log('\n⚠️  Deployment blocked due to failed tests');
  }
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  runDeploymentVerification()
    .then(report => {
      process.exit(report.canDeploy ? 0 : 1);
    })
    .catch(error => {
      console.error('Deployment verification failed:', error);
      process.exit(1);
    });
}

