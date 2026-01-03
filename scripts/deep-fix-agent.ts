/**
 * Deep Fix Agent - Advanced error fixing with multiple strategies
 * Used by QA Agent when initial fixes fail
 */

import { scrapeTrafficData } from '../lib/scraper';
import { testSelectorsForDomain, generateFixSuggestions } from '../lib/selector-fixer';
import * as fs from 'fs';
import * as path from 'path';

interface FixStrategy {
  name: string;
  description: string;
  attempt: (domain: string, error: string) => Promise<{ success: boolean; details: string }>;
}

/**
 * Strategy 1: Increase wait times and retry
 */
async function strategyIncreaseWaits(domain: string, error: string): Promise<{ success: boolean; details: string }> {
  console.log(`  🔧 Strategy 1: Increasing wait times for ${domain}...`);
  
  // This would require modifying scraper to accept wait parameters
  // For now, we'll test with a longer timeout
  try {
    // Test if domain is accessible with longer waits
    const url = `https://traffic.cv/bulk?domains=${domain}`;
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(10000); // Wait 10 seconds
    
    const pageText = await page.textContent('body') || '';
    await browser.close();
    
    if (pageText.toLowerCase().includes(domain.toLowerCase().replace(/^www\./, ''))) {
      return { success: true, details: 'Domain found on page with increased wait times' };
    }
    
    return { success: false, details: 'Domain still not found after increased wait' };
  } catch (e) {
    return { success: false, details: `Error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

/**
 * Strategy 2: Try different domain variations
 */
async function strategyDomainVariations(domain: string, error: string): Promise<{ success: boolean; details: string }> {
  console.log(`  🔧 Strategy 2: Trying domain variations for ${domain}...`);
  
  const variations = [
    domain,
    domain.replace(/^www\./, ''),
    `www.${domain.replace(/^www\./, '')}`,
    domain.replace(/^https?:\/\//, ''),
    `https://${domain}`,
  ];
  
  for (const variation of variations) {
    if (variation === domain) continue; // Skip original
    
    try {
      const results = await scrapeTrafficData([variation], false);
      if (results.length > 0 && !results[0].error) {
        return { success: true, details: `Found with variation: ${variation}` };
      }
    } catch (e) {
      continue;
    }
  }
  
  return { success: false, details: 'No working domain variation found' };
}

/**
 * Strategy 3: Test and update selectors
 */
async function strategySelectorFix(domain: string, error: string): Promise<{ success: boolean; details: string }> {
  console.log(`  🔧 Strategy 3: Testing selectors for ${domain}...`);
  
  try {
    const testResults = await testSelectorsForDomain(domain);
    
    if (testResults.workingSelectors.length > 0) {
      // Save fix suggestion
      const fixesDir = path.join(process.cwd(), 'auto-fixes');
      if (!fs.existsSync(fixesDir)) {
        fs.mkdirSync(fixesDir, { recursive: true });
      }
      
      const suggestions = generateFixSuggestions(error, testResults);
      const fixFile = path.join(fixesDir, `deep-fix-${domain}-${Date.now()}.md`);
      fs.writeFileSync(fixFile, suggestions);
      
      return { 
        success: true, 
        details: `Found ${testResults.workingSelectors.length} working selector(s). Fix suggestions saved to ${fixFile}` 
      };
    }
    
    return { success: false, details: 'No working selectors found' };
  } catch (e) {
    return { success: false, details: `Selector test error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

/**
 * Strategy 4: Check if domain actually exists/has traffic
 */
async function strategyDomainCheck(domain: string, error: string): Promise<{ success: boolean; details: string }> {
  console.log(`  🔧 Strategy 4: Checking domain validity for ${domain}...`);
  
  try {
    // Check if domain resolves
    const dns = await import('dns/promises');
    try {
      await dns.lookup(domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]);
      return { success: true, details: 'Domain resolves, may have 0 traffic' };
    } catch (e) {
      return { success: false, details: 'Domain does not resolve (may not exist)' };
    }
  } catch (e) {
    // DNS module not available, skip
    return { success: false, details: 'DNS check not available' };
  }
}

/**
 * Apply deep fix strategies in sequence
 */
export async function applyDeepFixStrategies(
  domain: string,
  error: string
): Promise<{ fixed: boolean; attempts: Array<{ strategy: string; success: boolean; details: string }> }> {
  console.log(`\n🧠 Applying deep fix strategies for ${domain}...`);
  console.log(`   Error: ${error}`);
  
  const strategies: FixStrategy[] = [
    { name: 'Increase Waits', description: 'Try with longer wait times', attempt: strategyIncreaseWaits },
    { name: 'Domain Variations', description: 'Try different domain formats', attempt: strategyDomainVariations },
    { name: 'Selector Fix', description: 'Test and find working selectors', attempt: strategySelectorFix },
    { name: 'Domain Check', description: 'Verify domain validity', attempt: strategyDomainCheck },
  ];
  
  const attempts: Array<{ strategy: string; success: boolean; details: string }> = [];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy.attempt(domain, error);
      attempts.push({
        strategy: strategy.name,
        success: result.success,
        details: result.details,
      });
      
      if (result.success) {
        console.log(`   ✅ Strategy "${strategy.name}" succeeded: ${result.details}`);
        return { fixed: true, attempts };
      } else {
        console.log(`   ❌ Strategy "${strategy.name}" failed: ${result.details}`);
      }
    } catch (e) {
      attempts.push({
        strategy: strategy.name,
        success: false,
        details: `Exception: ${e instanceof Error ? e.message : 'Unknown'}`,
      });
      console.log(`   ❌ Strategy "${strategy.name}" threw error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }
  
  console.log(`   ❌ All deep fix strategies failed for ${domain}`);
  return { fixed: false, attempts };
}

