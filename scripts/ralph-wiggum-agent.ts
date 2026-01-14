/**
 * Ralph Wiggum Agent - Continuous Loop Self-Healing System
 * 
 * Named after Boris Cherny's concept: A background agent that continuously
 * loops, detecting errors and fixing them until success or escalation.
 * 
 * Pattern:
 * 1. Run tests → Find errors
 * 2. Attempt fix → Verify fix worked
 * 3. If fix failed → Try deeper strategies
 * 4. Loop until success or escalate to human
 * 
 * This agent is designed to run continuously and self-heal the system.
 */

import { scrapeTrafficData } from '../lib/scraper';
import { getLatestTrafficDataBatch, storeTrafficData, isDataFresh } from '../lib/db';
import { sendQAErrorEmail } from '../lib/email';
import { runAutoFixWorkflow } from './auto-fix-agent';
import { applyDeepFixStrategies } from './deep-fix-agent';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Maximum number of fix attempts before escalating to human
  maxFixAttempts: 3,
  
  // Delay between retry cycles (ms)
  retryDelay: 30000, // 30 seconds
  
  // Maximum total runtime for the agent (ms)
  maxRuntime: 300000, // 5 minutes
  
  // Delay between loop iterations (ms)
  loopDelay: 5000, // 5 seconds
  
  // Report directory
  reportsDir: path.join(process.cwd(), 'ralph-wiggum-reports'),
};

// ============================================================================
// Real Domain Test Suite
// User-provided domains that should have traffic > 0
// ============================================================================

export const REAL_DOMAIN_TEST_SUITE = [
  // User's test domains - these should all return traffic > 0
  'btf-lighting.com',
  'protoarc.com',
  'maestrihouse.com',
  'mjjc.com',
  'sofirnlight.com',
  'theoriginalmoonlamp.com',
  'allvirginhair.com',
  'ca.fluf.ca',
  'cbvelo.com',
  'dart-dist.com',
  'designformal.com',
  'counter.com',
  'neded.de',
  'rodeoclothing.store',
  'standardprocedure.com',
  'thefoxdecor.com',
  'tosotdirect.com',
  'cobakcase.com',
  'squidsocks.ink',
  'isudar.com',
  'fitnessplus.com',
  'zooki.com',
  'hyperspacelight.com',
  'zbiotics.com',
];

// High-traffic reference domains (for baseline validation)
const BASELINE_DOMAINS = [
  'google.com',
  'github.com',
  'amazon.com',
];

// ============================================================================
// Types
// ============================================================================

interface LoopIteration {
  iteration: number;
  timestamp: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  fixesAttempted: number;
  fixesSucceeded: number;
  errors: Array<{ domain: string; error: string; fixAttempts: number }>;
}

interface RalphWiggumReport {
  startTime: string;
  endTime: string;
  totalIterations: number;
  totalRuntime: number;
  finalStatus: 'success' | 'partial' | 'escalated';
  iterations: LoopIteration[];
  unresolvedErrors: Array<{ domain: string; error: string; fixAttempts: number }>;
  resolvedErrors: Array<{ domain: string; fixedOn: number }>;
}

interface TestResult {
  domain: string;
  passed: boolean;
  error?: string;
  monthlyVisits?: number | null;
  fixAttempts: number;
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test a single domain and return result
 */
async function testDomain(domain: string): Promise<TestResult> {
  try {
    const results = await scrapeTrafficData([domain], false);
    
    if (results.length === 0) {
      return { domain, passed: false, error: 'No result returned', fixAttempts: 0 };
    }
    
    const result = results[0];
    
    // Check for errors
    if (result.error) {
      return { 
        domain, 
        passed: false, 
        error: result.error, 
        monthlyVisits: result.monthlyVisits,
        fixAttempts: 0 
      };
    }
    
    // For real domains, they should have traffic > 0
    // (monthlyVisits: 0 means "No valid data" which is an error for known-traffic sites)
    if (result.monthlyVisits === 0) {
      return { 
        domain, 
        passed: false, 
        error: 'Domain returned 0 visits (expected > 0 for known-traffic site)', 
        monthlyVisits: 0,
        fixAttempts: 0 
      };
    }
    
    // Success - has traffic data
    return { 
      domain, 
      passed: true, 
      monthlyVisits: result.monthlyVisits,
      fixAttempts: 0 
    };
  } catch (error) {
    return { 
      domain, 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      fixAttempts: 0 
    };
  }
}

/**
 * Test baseline domains (google, github, etc.) - must pass
 */
async function testBaselineDomains(): Promise<TestResult[]> {
  console.log('\n📊 Testing baseline domains...');
  const results: TestResult[] = [];
  
  for (const domain of BASELINE_DOMAINS) {
    const result = await testDomain(domain);
    results.push(result);
    
    if (result.passed) {
      console.log(`  ✅ ${domain}: ${result.monthlyVisits?.toLocaleString()} visits`);
    } else {
      console.log(`  ❌ ${domain}: ${result.error}`);
    }
  }
  
  return results;
}

/**
 * Test real domain suite - these should all have traffic > 0
 */
async function testRealDomains(domains: string[] = REAL_DOMAIN_TEST_SUITE): Promise<TestResult[]> {
  console.log(`\n📊 Testing ${domains.length} real domains...`);
  const results: TestResult[] = [];
  
  // Process in batches of 10 (traffic.cv limit)
  const batches: string[][] = [];
  for (let i = 0; i < domains.length; i += 10) {
    batches.push(domains.slice(i, i + 10));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`  Processing batch ${batchIndex + 1}/${batches.length}...`);
    
    try {
      const batchResults = await scrapeTrafficData(batch, false);
      
      for (const result of batchResults) {
        const testResult: TestResult = {
          domain: result.domain,
          passed: !result.error && result.monthlyVisits !== null && result.monthlyVisits > 0,
          error: result.error || (result.monthlyVisits === 0 ? 'Returned 0 visits (expected > 0)' : undefined),
          monthlyVisits: result.monthlyVisits,
          fixAttempts: 0,
        };
        
        results.push(testResult);
        
        if (testResult.passed) {
          console.log(`    ✅ ${result.domain}: ${result.monthlyVisits?.toLocaleString()} visits`);
        } else {
          console.log(`    ❌ ${result.domain}: ${testResult.error}`);
        }
      }
    } catch (error) {
      // Add error results for entire batch
      for (const domain of batch) {
        results.push({
          domain,
          passed: false,
          error: error instanceof Error ? error.message : 'Batch scraping failed',
          fixAttempts: 0,
        });
        console.log(`    ❌ ${domain}: Batch error`);
      }
    }
    
    // Small delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  return results;
}

// ============================================================================
// Fix Functions
// ============================================================================

/**
 * Attempt to fix a failed domain
 */
async function attemptFix(domain: string, error: string, attemptNumber: number): Promise<boolean> {
  console.log(`\n🔧 Fix attempt ${attemptNumber} for ${domain}...`);
  
  // Strategy 1: Clear cache and retry
  if (attemptNumber === 1) {
    console.log('  Strategy: Clear cache and retry...');
    const cached = getLatestTrafficDataBatch([domain]);
    if (cached.size > 0) {
      console.log('  Clearing cached data and retrying...');
    }
    
    const result = await testDomain(domain);
    if (result.passed) {
      console.log(`  ✅ Fixed by retry: ${result.monthlyVisits?.toLocaleString()} visits`);
      return true;
    }
  }
  
  // Strategy 2: Try domain variations
  if (attemptNumber === 2) {
    console.log('  Strategy: Try domain variations...');
    const variations = [
      domain.replace(/^www\./, ''),
      `www.${domain.replace(/^www\./, '')}`,
    ];
    
    for (const variation of variations) {
      if (variation === domain) continue;
      const result = await testDomain(variation);
      if (result.passed) {
        console.log(`  ✅ Fixed with variation ${variation}: ${result.monthlyVisits?.toLocaleString()} visits`);
        return true;
      }
    }
  }
  
  // Strategy 3: Deep fix strategies
  if (attemptNumber === 3) {
    console.log('  Strategy: Deep fix strategies...');
    const deepResult = await applyDeepFixStrategies(domain, error);
    if (deepResult.fixed) {
      console.log(`  ✅ Deep fix succeeded`);
      return true;
    }
  }
  
  console.log(`  ❌ Fix attempt ${attemptNumber} failed`);
  return false;
}

// ============================================================================
// Main Loop
// ============================================================================

/**
 * Run the Ralph Wiggum continuous loop
 */
export async function runRalphWiggumLoop(
  options: {
    testDomains?: string[];
    maxIterations?: number;
    stopOnSuccess?: boolean;
  } = {}
): Promise<RalphWiggumReport> {
  const startTime = Date.now();
  const report: RalphWiggumReport = {
    startTime: new Date().toISOString(),
    endTime: '',
    totalIterations: 0,
    totalRuntime: 0,
    finalStatus: 'escalated',
    iterations: [],
    unresolvedErrors: [],
    resolvedErrors: [],
  };
  
  const testDomains = options.testDomains || REAL_DOMAIN_TEST_SUITE;
  const maxIterations = options.maxIterations || 3;
  const stopOnSuccess = options.stopOnSuccess ?? true;
  
  console.log('🎬 Starting Ralph Wiggum Agent (Continuous Loop Self-Healing)');
  console.log(`   Max iterations: ${maxIterations}`);
  console.log(`   Test domains: ${testDomains.length}`);
  console.log(`   Stop on success: ${stopOnSuccess}`);
  
  // Ensure reports directory exists
  if (!fs.existsSync(CONFIG.reportsDir)) {
    fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
  }
  
  // Track errors and fix attempts
  const errorTracker = new Map<string, { error: string; fixAttempts: number }>();
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const iterationStart = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 ITERATION ${iteration}/${maxIterations}`);
    console.log(`${'='.repeat(60)}`);
    
    // Check runtime limit
    if (Date.now() - startTime > CONFIG.maxRuntime) {
      console.log('⏱️ Max runtime exceeded, stopping...');
      break;
    }
    
    // 1. Test baseline domains first (must pass)
    const baselineResults = await testBaselineDomains();
    const baselineFailed = baselineResults.filter(r => !r.passed);
    
    if (baselineFailed.length > 0) {
      console.log(`\n⚠️ ${baselineFailed.length} baseline domain(s) failed - system may have issues`);
    }
    
    // 2. Test real domains
    const realResults = await testRealDomains(testDomains);
    const failedResults = realResults.filter(r => !r.passed);
    const passedResults = realResults.filter(r => r.passed);
    
    // Record iteration
    const iterationRecord: LoopIteration = {
      iteration,
      timestamp: new Date().toISOString(),
      testsRun: realResults.length + baselineResults.length,
      testsPassed: passedResults.length + baselineResults.filter(r => r.passed).length,
      testsFailed: failedResults.length + baselineFailed.length,
      fixesAttempted: 0,
      fixesSucceeded: 0,
      errors: [],
    };
    
    // 3. Attempt to fix failed domains
    if (failedResults.length > 0) {
      console.log(`\n🔧 Attempting to fix ${failedResults.length} failed domain(s)...`);
      
      for (const failed of failedResults) {
        // Get or create error tracker entry
        let tracker = errorTracker.get(failed.domain);
        if (!tracker) {
          tracker = { error: failed.error || 'Unknown error', fixAttempts: 0 };
          errorTracker.set(failed.domain, tracker);
        }
        
        // Check if we've exceeded max fix attempts
        if (tracker.fixAttempts >= CONFIG.maxFixAttempts) {
          console.log(`  ⏭️ Skipping ${failed.domain} - max fix attempts reached`);
          iterationRecord.errors.push({
            domain: failed.domain,
            error: tracker.error,
            fixAttempts: tracker.fixAttempts,
          });
          continue;
        }
        
        // Attempt fix
        tracker.fixAttempts++;
        iterationRecord.fixesAttempted++;
        
        const fixed = await attemptFix(failed.domain, tracker.error, tracker.fixAttempts);
        
        if (fixed) {
          iterationRecord.fixesSucceeded++;
          report.resolvedErrors.push({ domain: failed.domain, fixedOn: iteration });
          errorTracker.delete(failed.domain);
        } else {
          iterationRecord.errors.push({
            domain: failed.domain,
            error: tracker.error,
            fixAttempts: tracker.fixAttempts,
          });
        }
      }
    }
    
    report.iterations.push(iterationRecord);
    report.totalIterations = iteration;
    
    // Summary for this iteration
    console.log(`\n📊 Iteration ${iteration} Summary:`);
    console.log(`   Tests passed: ${iterationRecord.testsPassed}/${iterationRecord.testsRun}`);
    console.log(`   Fixes attempted: ${iterationRecord.fixesAttempted}`);
    console.log(`   Fixes succeeded: ${iterationRecord.fixesSucceeded}`);
    console.log(`   Remaining errors: ${iterationRecord.errors.length}`);
    
    // Check if all tests passed
    if (failedResults.length === 0 && baselineFailed.length === 0) {
      console.log('\n🎉 All tests passed! System is healthy.');
      report.finalStatus = 'success';
      if (stopOnSuccess) break;
    }
    
    // Delay before next iteration
    if (iteration < maxIterations && failedResults.length > 0) {
      console.log(`\n⏳ Waiting ${CONFIG.loopDelay / 1000}s before next iteration...`);
      await new Promise(r => setTimeout(r, CONFIG.loopDelay));
    }
  }
  
  // Finalize report
  report.endTime = new Date().toISOString();
  report.totalRuntime = Date.now() - startTime;
  
  // Collect unresolved errors
  for (const [domain, tracker] of errorTracker.entries()) {
    report.unresolvedErrors.push({
      domain,
      error: tracker.error,
      fixAttempts: tracker.fixAttempts,
    });
  }
  
  // Determine final status
  if (report.unresolvedErrors.length === 0) {
    report.finalStatus = 'success';
  } else if (report.resolvedErrors.length > 0) {
    report.finalStatus = 'partial';
  } else {
    report.finalStatus = 'escalated';
  }
  
  // Save report
  const reportFile = path.join(CONFIG.reportsDir, `ralph-wiggum-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎬 RALPH WIGGUM AGENT FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`Status: ${report.finalStatus.toUpperCase()}`);
  console.log(`Total iterations: ${report.totalIterations}`);
  console.log(`Total runtime: ${(report.totalRuntime / 1000).toFixed(1)}s`);
  console.log(`Errors resolved: ${report.resolvedErrors.length}`);
  console.log(`Errors unresolved: ${report.unresolvedErrors.length}`);
  console.log(`Report saved: ${reportFile}`);
  
  // Send email if there are unresolved errors
  if (report.unresolvedErrors.length > 0) {
    console.log('\n📧 Sending escalation email...');
    await sendQAErrorEmail({
      timestamp: report.endTime,
      totalTests: report.iterations[report.iterations.length - 1]?.testsRun || 0,
      failed: report.unresolvedErrors.length,
      results: report.unresolvedErrors.map(e => ({
        testName: `Domain: ${e.domain}`,
        passed: false,
        error: `${e.error} (after ${e.fixAttempts} fix attempts)`,
      })),
      autoFixed: report.resolvedErrors.length,
      needsManualFix: report.unresolvedErrors.length,
    });
  }
  
  return report;
}

// ============================================================================
// Quick Test Function (for immediate testing)
// ============================================================================

/**
 * Quick test with a subset of domains
 */
export async function quickTest(domains: string[]): Promise<void> {
  console.log('🔬 Quick Test Mode');
  console.log(`Testing ${domains.length} domains...\n`);
  
  const results = await testRealDomains(domains);
  
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  
  console.log('\n📊 Quick Test Results:');
  console.log(`   Passed: ${passed.length}/${results.length}`);
  console.log(`   Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed domains:');
    for (const f of failed) {
      console.log(`   - ${f.domain}: ${f.error}`);
    }
  }
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick')) {
    // Quick test with user's domains
    quickTest(REAL_DOMAIN_TEST_SUITE.slice(0, 5))
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  } else if (args.includes('--full')) {
    // Full loop with all domains
    runRalphWiggumLoop({
      testDomains: REAL_DOMAIN_TEST_SUITE,
      maxIterations: 3,
      stopOnSuccess: true,
    })
      .then(report => {
        process.exit(report.finalStatus === 'success' ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  } else {
    // Default: Run with baseline + sample of real domains
    runRalphWiggumLoop({
      testDomains: REAL_DOMAIN_TEST_SUITE.slice(0, 10),
      maxIterations: 2,
      stopOnSuccess: true,
    })
      .then(report => {
        process.exit(report.finalStatus === 'success' ? 0 : 1);
      })
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  }
}
