/**
 * Extract historical monthly traffic data from traffic.cv's "Visits Over Time" graph
 */

import { Page } from 'playwright';
import { parseNumberWithSuffix } from './parsing-utils';

export interface HistoricalMonthData {
  monthYear: string; // Format: "YYYY-MM"
  monthlyVisits: number | null;
}

/**
 * Extract last 3 months of traffic data from the "Visits Over Time" graph
 * Graph shows data like: 2025/09, 2025/10, 2025/11 with visit values
 */
export async function extractHistoricalMonths(
  page: Page,
  domain: string
): Promise<HistoricalMonthData[]> {
  const results: HistoricalMonthData[] = [];
  
  try {
    // Wait a bit for graph to render
    await page.waitForTimeout(2000);
    // Look for the "Visits Over Time" graph
    // It could be in various formats: SVG, canvas, or text-based
    // Try multiple selectors
    const graphSelectors = [
      '[class*="graph"]',
      '[class*="chart"]',
      '[class*="visits"]',
      'svg',
      'canvas',
      '[id*="graph"]',
      '[id*="chart"]',
    ];

    let graphElement = null;
    for (const selector of graphSelectors) {
      graphElement = await page.$(selector);
      if (graphElement) break;
    }

    // Method 1: Try to extract from SVG text elements (common in charts)
    if (graphElement) {
      const svgTexts = await graphElement.$$eval('text', (texts) =>
        texts.map(t => t.textContent || '')
      );
      
      // Look for month patterns like "2025/09", "2025/10", "2025/11"
      const monthPattern = /(\d{4})\/(\d{2})/g;
      const visitPattern = /([\d.,]+\s*[KMkmBb]?)\s*(?:visits?|k|m|b)?/i;
      
      for (const text of svgTexts) {
        const monthMatch = text.match(monthPattern);
        if (monthMatch) {
          // Found a month label, look for visit value nearby
          const visitMatch = text.match(visitPattern);
          if (visitMatch) {
            const [year, month] = monthMatch[0].split('/');
            const monthYear = `${year}-${month}`;
            const visits = parseNumberWithSuffix(visitMatch[1]);
            if (visits) {
              results.push({ monthYear, monthlyVisits: visits });
            }
          }
        }
      }
    }

    // Method 2: Extract from page text (look for tooltip patterns)
    // Tooltips often show: "2025/09 visits: 576.19K" or "2025/09\nvisits: 576.19K"
    const pageText = await page.textContent('body') || '';
    
    // More flexible pattern - handle various formats
    const tooltipPatterns = [
      /(\d{4})\/(\d{2})\s+visits?[:\s]+([\d.,]+\s*[KMkmBb]?)/gi,
      /(\d{4})\/(\d{2})[:\s]*([\d.,]+\s*[KMkmBb]?)\s*visits?/gi,
      /(\d{4})\/(\d{2})[^\d]*([\d.,]+\s*[KMkmBb]?)/gi, // More flexible - any separator
    ];
    
    for (const pattern of tooltipPatterns) {
      let match;
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      while ((match = pattern.exec(pageText)) !== null) {
        const [_, year, month, visitsStr] = match;
        const monthYear = `${year}-${month}`;
        const visits = parseNumberWithSuffix(visitsStr);
        if (visits && visits > 0) {
          // Avoid duplicates
          if (!results.find(r => r.monthYear === monthYear)) {
            results.push({ monthYear, monthlyVisits: visits });
          }
        }
      }
    }
    
    // Method 2.5: Look for hover tooltips or chart data in HTML
    // Some charts show data on hover - try to trigger hover or find hidden data
    const chartElements = await page.$$('[class*="chart"], [class*="graph"], [class*="visits-over-time"]');
    for (const chart of chartElements) {
      const chartText = await chart.textContent();
      if (chartText) {
        // Look for patterns like "2025/09" followed by numbers
        const monthDataPattern = /(\d{4})\/(\d{2})[^\d]*([\d.,]+\s*[KMkmBb]?)/g;
        let match;
        while ((match = monthDataPattern.exec(chartText)) !== null) {
          const [_, year, month, visitsStr] = match;
          const monthYear = `${year}-${month}`;
          const visits = parseNumberWithSuffix(visitsStr);
          if (visits && visits > 0 && !results.find(r => r.monthYear === monthYear)) {
            results.push({ monthYear, monthlyVisits: visits });
          }
        }
      }
    }

    // Method 3: Look for data attributes or structured data
    // Some charts store data in data attributes
    const dataElements = await page.$$('[data-month], [data-date], [data-visits]');
    for (const elem of dataElements) {
      const monthAttr = await elem.getAttribute('data-month') || 
                       await elem.getAttribute('data-date');
      const visitsAttr = await elem.getAttribute('data-visits') ||
                        await elem.getAttribute('data-value');
      
      if (monthAttr && visitsAttr) {
        // Parse month format (could be YYYY/MM or YYYY-MM)
        const monthMatch = monthAttr.match(/(\d{4})[\/\-](\d{2})/);
        if (monthMatch) {
          const [_, year, month] = monthMatch;
          const monthYear = `${year}-${month}`;
          const visits = parseNumberWithSuffix(visitsAttr);
          if (visits && !results.find(r => r.monthYear === monthYear)) {
            results.push({ monthYear, monthlyVisits: visits });
          }
        }
      }
    }

    // Method 4: Look for table or list of historical data
    // Some pages show historical data in a table format
    const tableRows = await page.$$('table tbody tr, [class*="history"] tr, [class*="month"]');
    for (const row of tableRows) {
      const rowText = await row.textContent();
      if (rowText) {
        const monthMatch = rowText.match(/(\d{4})[\/\-](\d{2})/);
        const visitMatch = rowText.match(/([\d.,]+\s*[KMkmBb]?)/);
        if (monthMatch && visitMatch) {
          const [_, year, month] = monthMatch;
          const monthYear = `${year}-${month}`;
          const visits = parseNumberWithSuffix(visitMatch[1]);
          if (visits && !results.find(r => r.monthYear === monthYear)) {
            results.push({ monthYear, monthlyVisits: visits });
          }
        }
      }
    }

    // Sort by month (most recent first)
    results.sort((a, b) => b.monthYear.localeCompare(a.monthYear));

    // Log for debugging
    if (results.length > 0) {
      console.log(`Extracted ${results.length} historical months for ${domain}:`, results.map(r => `${r.monthYear}=${r.monthlyVisits}`).join(', '));
    } else {
      console.log(`No historical months extracted for ${domain}`);
    }

    // Return up to 3 months (last 3 months)
    return results.slice(0, 3);
  } catch (error) {
    console.error(`Error extracting historical months for ${domain}:`, error);
    return [];
  }
}

