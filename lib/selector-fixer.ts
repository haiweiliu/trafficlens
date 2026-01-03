/**
 * Automatic selector fixing system
 * Detects selector errors and tries alternative selectors
 */

import { chromium, Browser, Page } from 'playwright';

interface SelectorTestResult {
  selector: string;
  found: number;
  hasData: boolean;
  sampleText?: string;
}

/**
 * Test different selectors to find which ones work
 */
export async function testSelectorsForDomain(
  domain: string
): Promise<{
  workingSelectors: string[];
  pageStructure: string;
  recommendations: string[];
}> {
  const url = `https://traffic.cv/bulk?domains=${domain}`;
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000); // Wait for data to load

    // Test various selectors
    const selectorTests: SelectorTestResult[] = [];
    
    const selectorsToTest = [
      // Card selectors
      '[class*="card"]',
      'article',
      '[class*="result"]',
      '[data-domain]',
      '[class*="domain"]',
      '.card',
      '[role="article"]',
      '[class*="traffic"]',
      
      // Table selectors
      'table tbody tr',
      '.table tbody tr',
      'table tr',
      '[role="row"]',
      'tbody > tr',
    ];

    for (const selector of selectorsToTest) {
      try {
        const elements = await page.$$(selector);
        const hasData = elements.length > 0;
        
        let sampleText = '';
        if (elements.length > 0) {
          sampleText = (await elements[0].textContent())?.substring(0, 200) || '';
        }

        selectorTests.push({
          selector,
          found: elements.length,
          hasData: hasData && sampleText.length > 20,
          sampleText,
        });
      } catch (e) {
        selectorTests.push({
          selector,
          found: 0,
          hasData: false,
        });
      }
    }

    // Get page structure for analysis
    const pageStructure = await page.evaluate(() => {
      const body = document.body;
      const cards = Array.from(body.querySelectorAll('[class*="card"], article, [class*="result"]'));
      const tables = Array.from(body.querySelectorAll('table'));
      
      return JSON.stringify({
        cardCount: cards.length,
        tableCount: tables.length,
        cardClasses: Array.from(new Set(
          cards.slice(0, 5).flatMap(el => Array.from(el.classList))
        )),
        hasDomain: body.textContent?.includes(domain) || false,
      }, null, 2);
    });

    // Find working selectors
    const workingSelectors = selectorTests
      .filter(test => test.hasData)
      .map(test => test.selector);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (workingSelectors.length === 0) {
      recommendations.push('No working selectors found. Page structure may have changed significantly.');
      recommendations.push('Consider checking traffic.cv manually to see current structure.');
    } else {
      recommendations.push(`Working selectors found: ${workingSelectors.join(', ')}`);
      recommendations.push('Update extractFromCards() or extractFromTable() to use these selectors.');
    }

    return {
      workingSelectors,
      pageStructure,
      recommendations,
    };
  } catch (error) {
    console.error('Error testing selectors:', error);
    return {
      workingSelectors: [],
      pageStructure: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendations: ['Error occurred while testing selectors'],
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate fix suggestions based on error and test results
 */
export function generateFixSuggestions(
  error: string,
  testResults: {
    workingSelectors: string[];
    pageStructure: string;
    recommendations: string[];
  }
): string {
  let suggestions = `# Selector Fix Suggestions\n\n`;
  suggestions += `**Error:** ${error}\n\n`;
  
  if (testResults.workingSelectors.length > 0) {
    suggestions += `## Working Selectors Found\n\n`;
    suggestions += testResults.workingSelectors.map(sel => `- \`${sel}\``).join('\n');
    suggestions += `\n\n`;
    suggestions += `## Recommended Fix\n\n`;
    suggestions += `Update \`lib/scraper.ts\` to add these selectors to the selector arrays:\n\n`;
    suggestions += `\`\`\`typescript\n`;
    suggestions += `const cardSelectors = [\n`;
    suggestions += `  ${testResults.workingSelectors.map(sel => `'${sel}'`).join(',\n  ')},\n`;
    suggestions += `  // ... existing selectors\n];\n`;
    suggestions += `\`\`\`\n\n`;
  } else {
    suggestions += `## No Working Selectors Found\n\n`;
    suggestions += `The page structure may have changed significantly.\n\n`;
    suggestions += `**Page Structure:**\n\`\`\`json\n${testResults.pageStructure}\n\`\`\`\n\n`;
    suggestions += `**Next Steps:**\n`;
    suggestions += `1. Manually check ${error.includes('iambrandluxury') ? 'iambrandluxury.com' : 'the domain'} on traffic.cv\n`;
    suggestions += `2. Inspect the page structure using browser DevTools\n`;
    suggestions += `3. Update selectors based on current HTML structure\n`;
  }

  return suggestions;
}

