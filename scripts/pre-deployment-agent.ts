/**
 * Pre-Deployment Validation Agent for TrafficLens
 * Runs before Railway deployment to catch build errors and ensure successful deployments
 * Prevents deployment failures by validating code before push
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationTest {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

interface PreDeploymentReport {
  timestamp: string;
  tests: ValidationTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  canDeploy: boolean;
}

/**
 * Test 1: TypeScript Compilation
 */
function testTypeScriptCompilation(): ValidationTest {
  const name = 'TypeScript Compilation';
  try {
    // Run TypeScript compiler in check mode (no emit)
    execSync('npx tsc --noEmit', {
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    
    return {
      name,
      passed: true,
    };
  } catch (error: any) {
    const errorMessage = error.stdout?.toString() || error.stderr?.toString() || error.message;
    return {
      name,
      passed: false,
      error: 'TypeScript compilation errors found',
      details: { errorMessage: errorMessage.slice(0, 500) }, // Limit error message length
    };
  }
}

/**
 * Test 2: Next.js Build
 */
async function testNextJsBuild(): Promise<ValidationTest> {
  const name = 'Next.js Build';
  try {
    // Run Next.js build
    execSync('npm run build', {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
    });
    
    return {
      name,
      passed: true,
    };
  } catch (error: any) {
    const errorMessage = error.stdout?.toString() || error.stderr?.toString() || error.message;
    return {
      name,
      passed: false,
      error: 'Next.js build failed',
      details: { errorMessage: errorMessage.slice(0, 500) },
    };
  }
}

/**
 * Test 3: Critical File Existence
 */
function testCriticalFilesExist(): ValidationTest {
  const name = 'Critical Files Exist';
  const criticalFiles = [
    'package.json',
    'next.config.js',
    'tsconfig.json',
    'lib/db.ts',
    'lib/scraper.ts',
    'app/api/traffic/route.ts',
  ];
  
  const missing: string[] = [];
  for (const file of criticalFiles) {
    if (!fs.existsSync(path.join(process.cwd(), file))) {
      missing.push(file);
    }
  }
  
  if (missing.length > 0) {
    return {
      name,
      passed: false,
      error: `Missing critical files: ${missing.join(', ')}`,
      details: { missing },
    };
  }
  
  return {
    name,
    passed: true,
  };
}

/**
 * Test 4: Export Validation
 */
function testExportValidation(): ValidationTest {
  const name = 'Export Validation';
  try {
    // Check that getDb is exported from lib/db.ts
    const dbFile = fs.readFileSync(path.join(process.cwd(), 'lib/db.ts'), 'utf-8');
    
    const issues: string[] = [];
    
    // Check for getDb export
    if (!dbFile.includes('export function getDb')) {
      issues.push('getDb is not exported from lib/db.ts');
    }
    
    // Check for common export patterns that might cause issues
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scriptFiles = fs.readdirSync(scriptsDir)
        .filter((file): file is string => typeof file === 'string' && file.endsWith('-agent.ts'));
      
      for (const file of scriptFiles) {
        const content = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
        
        // Check for await import patterns that might fail (skip this check - require() is fine)
        // await import() is valid in async functions, and require() is fine in sync functions
        
        // Check for require patterns with getDb
        if (content.includes("require('../lib/db')") && !dbFile.includes('export function getDb')) {
          issues.push(`${file}: Imports getDb but it's not exported`);
        }
      }
    }
    
    if (issues.length > 0) {
      return {
        name,
        passed: false,
        error: `Export validation issues found`,
        details: { issues },
      };
    }
    
    return {
      name,
      passed: true,
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
 * Test 5: Map vs Array Usage Validation
 */
function testMapUsageValidation(): ValidationTest {
  const name = 'Map vs Array Usage Validation';
  try {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      return {
        name,
        passed: true,
        details: { message: 'scripts directory not found' },
      };
    }
    
    const scriptFiles = fs.readdirSync(scriptsDir)
      .filter((file): file is string => typeof file === 'string' && file.endsWith('-agent.ts'));
    
    const issues: string[] = [];
    
    for (const file of scriptFiles) {
      // Skip pre-deployment-agent.ts itself (it's the validator, not the code being validated)
      if (file === 'pre-deployment-agent.ts') {
        continue;
      }
      
      const content = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
      
      // Check for getLatestTrafficDataBatch usage
      if (content.includes('getLatestTrafficDataBatch')) {
        const lines = content.split('\n');
        
        // Find all getLatestTrafficDataBatch calls and check their usage
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('getLatestTrafficDataBatch')) {
            // Extract variable name from assignment (e.g., "const results = getLatestTrafficDataBatch(...)")
            const assignmentMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*getLatestTrafficDataBatch/);
            if (assignmentMatch) {
              const varName = assignmentMatch[1];
              
              // Check next 15 lines for incorrect usage of this variable
              const nextLines = lines.slice(i, Math.min(i + 15, lines.length));
              const nextContent = nextLines.join('\n');
              
              // Check for .length usage (should be .size)
              if (new RegExp(`${varName}\\.length`).test(nextContent) && 
                  !new RegExp(`${varName}\\.size`).test(nextContent)) {
                issues.push(`${file}: Uses ${varName}.length on getLatestTrafficDataBatch result (should use .size for Map)`);
                break;
              }
              
              // Check for array indexing (should use .get())
              if (new RegExp(`${varName}\\[0\\]`).test(nextContent) && 
                  !new RegExp(`${varName}\\.get\\(`).test(nextContent)) {
                issues.push(`${file}: Uses ${varName}[0] on getLatestTrafficDataBatch result (should use .get() for Map)`);
                break;
              }
            }
          }
        }
      }
    }
    
    if (issues.length > 0) {
      return {
        name,
        passed: false,
        error: `Map usage validation issues found`,
        details: { issues },
      };
    }
    
    return {
      name,
      passed: true,
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
 * Test 6: Package.json Validation
 */
function testPackageJsonValidation(): ValidationTest {
  const name = 'Package.json Validation';
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return {
        name,
        passed: false,
        error: 'package.json not found',
      };
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const issues: string[] = [];
    
    // Check for required fields
    if (!packageJson.name) issues.push('Missing name field');
    if (!packageJson.version) issues.push('Missing version field');
    if (!packageJson.scripts) issues.push('Missing scripts field');
    
    // Check for build script
    if (!packageJson.scripts?.build) {
      issues.push('Missing build script');
    }
    
    // Check for required dependencies
    const requiredDeps = ['next', 'react', 'react-dom', 'typescript'];
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
        issues.push(`Missing dependency: ${dep}`);
      }
    }
    
    if (issues.length > 0) {
      return {
        name,
        passed: false,
        error: `Package.json validation issues`,
        details: { issues },
      };
    }
    
    return {
      name,
      passed: true,
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
 * Test 7: Node.js Version (from Deployment Verification Agent)
 */
async function testNodeVersion(): Promise<ValidationTest> {
  const name = 'Node.js Version';
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
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
 * Test 8: File System Permissions (from Deployment Verification Agent)
 */
async function testFileSystemPermissions(): Promise<ValidationTest> {
  const name = 'File System Permissions';
  try {
    const fs = require('fs');
    const path = require('path');
    
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
 * Test 9: Database Connectivity (from Deployment Verification Agent)
 */
async function testDatabaseConnectivity(): Promise<ValidationTest> {
  const name = 'Database Connectivity';
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    
    if (!result || result.test !== 1) {
      return {
        name,
        passed: false,
        error: 'Database query returned unexpected result',
      };
    }
    
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
 * Test 10: Browser Availability (from Deployment Verification Agent)
 */
async function testBrowserAvailability(): Promise<ValidationTest> {
  const name = 'Browser Availability (Playwright)';
  try {
    const { chromium } = require('playwright');
    
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
 * Run all pre-deployment validation tests
 */
export async function runPreDeploymentValidation(): Promise<PreDeploymentReport> {
  console.log('🚀 Starting Pre-Deployment Validation...');
  console.log('This will catch build errors before Railway deployment\n');
  
  const timestamp = new Date().toISOString();
  
  const tests: ValidationTest[] = [
    testCriticalFilesExist(),
    testPackageJsonValidation(),
    testExportValidation(),
    testMapUsageValidation(),
    await testTypeScriptCompilation(),
    await testNextJsBuild(),
    // Environment verification (merged from Deployment Verification Agent)
    await testNodeVersion(),
    await testFileSystemPermissions(),
    await testDatabaseConnectivity(),
    await testBrowserAvailability(),
  ];
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const canDeploy = failed === 0;
  
  const report: PreDeploymentReport = {
    timestamp,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
    },
    canDeploy,
  };
  
  console.log('\n📊 Pre-Deployment Validation Report:');
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Can Deploy: ${canDeploy ? '✅ YES' : '❌ NO'}\n`);
  
  for (const test of tests) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
      if (test.details) {
        if (test.details.issues) {
          test.details.issues.slice(0, 3).forEach((issue: string) => {
            console.log(`   • ${issue}`);
          });
        } else if (test.details.errorMessage) {
          console.log(`   ${test.details.errorMessage.split('\n').slice(0, 3).join('\n   ')}`);
        }
      }
    }
  }
  
  if (!canDeploy) {
    console.log('\n⚠️  Deployment blocked - fix errors before pushing to GitHub');
    console.log('   Railway deployment will fail if you push now');
  } else {
    console.log('\n✅ All validation tests passed - safe to deploy!');
  }
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  runPreDeploymentValidation()
    .then(report => {
      process.exit(report.canDeploy ? 0 : 1);
    })
    .catch(error => {
      console.error('Pre-deployment validation failed:', error);
      process.exit(1);
    });
}

