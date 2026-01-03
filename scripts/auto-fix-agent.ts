/**
 * Auto-Fix Agent - Automatically detects and fixes selector errors
 * Runs when errors are detected and attempts to find working selectors
 */

import { scrapeTrafficData } from '../lib/scraper';
import { testSelectorsForDomain, generateFixSuggestions } from '../lib/selector-fixer';
import { sendQAErrorEmail } from '../lib/email';
import * as fs from 'fs';
import * as path from 'path';

interface ErrorReport {
  domain: string;
  error: string;
  timestamp: string;
  fixAttempted: boolean;
  fixSucceeded: boolean;
  suggestions?: string;
}

/**
 * Detect errors from scraping results
 */
function detectErrors(results: Array<{ domain: string; error: string | null }>): Array<{ domain: string; error: string }> {
  return results
    .filter(r => r.error && r.error.includes('selectors'))
    .map(r => ({ domain: r.domain, error: r.error! }));
}

/**
 * Auto-fix selector errors
 */
export async function autoFixSelectorErrors(
  failedDomains: Array<{ domain: string; error: string }>
): Promise<ErrorReport[]> {
  const reports: ErrorReport[] = [];
  const fixesDir = path.join(process.cwd(), 'auto-fixes');

  // Ensure fixes directory exists
  if (!fs.existsSync(fixesDir)) {
    fs.mkdirSync(fixesDir, { recursive: true });
  }

  for (const { domain, error } of failedDomains) {
    console.log(`\n🔧 Attempting to fix selector error for: ${domain}`);
    console.log(`   Error: ${error}`);

    const report: ErrorReport = {
      domain,
      error,
      timestamp: new Date().toISOString(),
      fixAttempted: true,
      fixSucceeded: false,
    };

    try {
      // Test selectors for this domain
      const testResults = await testSelectorsForDomain(domain);
      
      // Generate fix suggestions
      const suggestions = generateFixSuggestions(error, testResults);
      report.suggestions = suggestions;

      // Save fix suggestions to file
      const fixFile = path.join(fixesDir, `fix-${domain}-${Date.now()}.md`);
      fs.writeFileSync(fixFile, suggestions);
      
      console.log(`   ✅ Fix suggestions saved to: ${fixFile}`);

      if (testResults.workingSelectors.length > 0) {
        report.fixSucceeded = true;
        console.log(`   ✅ Found ${testResults.workingSelectors.length} working selector(s)`);
        console.log(`   📝 Suggestions saved - manual code update required`);
      } else {
        console.log(`   ⚠️  No working selectors found - manual investigation needed`);
      }
    } catch (error) {
      console.error(`   ❌ Error during fix attempt:`, error);
      report.fixSucceeded = false;
      report.suggestions = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    reports.push(report);
  }

  return reports;
}

/**
 * Main auto-fix workflow
 * Can be called with specific failed domains or will test common failure cases
 */
export async function runAutoFixWorkflow(failedDomains?: Array<{ domain: string; error: string }>): Promise<void> {
  console.log('🚀 Starting Auto-Fix Agent Workflow...\n');

  let errors: Array<{ domain: string; error: string }>;
  
  if (failedDomains && failedDomains.length > 0) {
    // Use provided failed domains
    errors = failedDomains.filter(e => e.error.toLowerCase().includes('selector'));
    console.log(`Processing ${errors.length} selector error(s) from QA Agent...`);
  } else {
    // Test domains that commonly fail
    const testDomains = ['iambrandluxury.com', 'example.com'];
    console.log(`Testing ${testDomains.length} domains for errors...`);
    const results = await scrapeTrafficData(testDomains, false);
    errors = detectErrors(results);
  }
  
  if (errors.length === 0) {
    console.log('✅ No selector errors detected. System is healthy!');
    return;
  }

  console.log(`\n⚠️  Found ${errors.length} selector error(s):`);
  errors.forEach(({ domain, error }) => {
    console.log(`   - ${domain}: ${error}`);
  });

  // Attempt to fix
  console.log(`\n🔧 Attempting automatic fixes...`);
  const fixReports = await autoFixSelectorErrors(errors);

  // Summary
  const succeeded = fixReports.filter(r => r.fixSucceeded).length;
  const failed = fixReports.filter(r => !r.fixSucceeded).length;

  console.log(`\n📊 Auto-Fix Summary:`);
  console.log(`   ✅ Fixes found: ${succeeded}`);
  console.log(`   ❌ Needs manual fix: ${failed}`);

  // Save summary report
  const summaryFile = path.join(process.cwd(), 'auto-fixes', `summary-${Date.now()}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    fixesFound: succeeded,
    needsManualFix: failed,
    reports: fixReports,
  }, null, 2));

  console.log(`\n📄 Summary saved to: ${summaryFile}`);

  // Send email notification if errors found
  if (errors.length > 0) {
    console.log(`\n📧 Sending error notification email...`);
    await sendQAErrorEmail({
      timestamp: new Date().toISOString(),
      failed: errors.length,
      totalTests: testDomains.length,
      results: errors.map(({ domain, error }) => ({
        testName: `Selector Error: ${domain}`,
        passed: false,
        error: error,
      })),
    });
  }
}

/**
 * Entry point
 */
if (require.main === module) {
  runAutoFixWorkflow()
    .then(() => {
      console.log('\n✅ Auto-Fix workflow completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Auto-Fix workflow error:', error);
      process.exit(1);
    });
}

