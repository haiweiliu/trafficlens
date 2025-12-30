/**
 * Playwright-based scraper for Traffic.cv bulk traffic checker
 */

import { chromium, Browser, Page } from 'playwright';
import { parseNumberWithSuffix, parseDurationToSeconds, parsePercentage } from './parsing-utils';
import { TrafficData } from '@/types';
import { extractHistoricalMonths, HistoricalMonthData } from './historical-extractor';

/**
 * Scrapes traffic data from Traffic.cv bulk endpoint
 * @param domains Array of domains (max 10 per call)
 * @param dryRun If true, returns mock data without scraping
 */
export async function scrapeTrafficData(
  domains: string[],
  dryRun: boolean = false
): Promise<TrafficData[]> {
  if (dryRun) {
    return generateMockData(domains);
  }

  if (domains.length === 0) {
    return [];
  }

  if (domains.length > 10) {
    throw new Error('Maximum 10 domains per batch');
  }

  // Normalize domains for traffic.cv query (remove www. and ensure clean format)
  // But keep original domains for matching results back
  const normalizedForQuery = domains.map(d => {
    let normalized = d.toLowerCase().trim();
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');
    // Remove www.
    normalized = normalized.replace(/^www\./, '');
    // Remove paths
    normalized = normalized.split('/')[0].split('?')[0].split('#')[0];
    // Remove trailing dots
    normalized = normalized.replace(/\.+$/, '');
    return normalized;
  });

  const url = `https://traffic.cv/bulk?domains=${normalizedForQuery.join(',')}`;
  let browser: Browser | null = null;

  try {
    // Launch Chromium browser (works perfectly on Railway with full filesystem access)
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    
    // Optimize: Block unnecessary resources for faster loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Block images, fonts, stylesheets, media, websocket, manifest, other
      if (['image', 'stylesheet', 'font', 'media', 'websocket', 'manifest', 'other'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Optimize: Reduced timeouts for faster processing
    page.setDefaultTimeout(20000); // Reduced from 60s to 20s

    // Navigate to the bulk checker page
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); // Reduced from 30s to 15s

    // Optimize: Wait for results with shorter timeout
    let resultsFound = false;
    const possibleSelectors = [
      '[class*="card"]',  // Most likely for card view
      'table',
      '[class*="result"]',
      '[class*="domain"]',
    ];

    // Wait for results to appear - try selectors with shorter timeout
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 }); // Reduced from 3s to 2s
        resultsFound = true;
        break;
      } catch (e) {
        // Try next selector
      }
    }

    // Wait for data to render - balance between speed and reliability
    if (resultsFound) {
      // Wait for data to fully render (3s ensures data is loaded)
      await page.waitForTimeout(3000);
      
      // Additional check: Verify cards/table have actual content with metrics
      try {
        await page.waitForFunction(
          () => {
            const cards = document.querySelectorAll('[class*="card"], table tbody tr, [class*="result"]');
            let cardsWithData = 0;
            for (const card of cards) {
              const text = card.textContent || '';
              // Check if card has both domain and metrics (visits, duration, or percentage)
              if (text.length > 20 && 
                  text.match(/[a-z0-9]+\.[a-z]{2,}/i) && // Has domain
                  (text.match(/[\d.,]+\s*[KMkmBb]/i) || // Has visits number
                   text.match(/\d{2}:\d{2}:\d{2}/) || // Has duration
                   text.match(/[\d.]+%/))) { // Has percentage
                cardsWithData++;
              }
            }
            // Need at least 2 cards with data to ensure page is fully loaded
            return cardsWithData >= Math.min(2, cards.length);
          },
          { timeout: 5000 }
        ).catch(() => {
          // Continue even if this check times out - data might still be there
          console.log('Content verification timeout, proceeding anyway');
        });
      } catch (e) {
        // Continue if check fails
        console.log('Content verification failed, proceeding anyway');
      }
    } else {
      // Give more time if no selector found
      await page.waitForTimeout(5000);
    }

    // Minimal debug logging for performance
    console.log(`Page loaded: ${url}`);

    // Try to find results in table format first (most common)
    const tableResults = await extractFromTable(page, domains);
    if (tableResults.length > 0) {
      console.log(`Extracted ${tableResults.length} results from table (expected ${domains.length} domains)`);
      
      // Ensure all domains have results (fill missing ones with errors)
      const foundDomains = new Set(tableResults.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
      const missingDomains = domains.filter(d => {
        const dNorm = d.toLowerCase().replace(/^www\./, '');
        return !foundDomains.has(dNorm);
      });
      
      if (missingDomains.length > 0) {
        console.log(`Missing ${missingDomains.length} domains in table: ${missingDomains.join(', ')}`);
      }
      
      // Add error results for truly missing domains
      for (const domain of missingDomains) {
        tableResults.push({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: null,
          error: 'Domain not found in results',
        });
      }
      
      return tableResults;
    }

    // Fallback to card format
    const cardResults = await extractFromCards(page, domains);
    if (cardResults.length > 0) {
      // Ensure all domains have results
      const foundDomains = new Set(cardResults.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
      const missingDomains = domains.filter(d => {
        const dNorm = d.toLowerCase().replace(/^www\./, '');
        return !foundDomains.has(dNorm);
      });
      
      for (const domain of missingDomains) {
        cardResults.push({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: null,
          error: 'Domain not found in results',
        });
      }
      
      return cardResults;
    }

    // Try a more generic extraction approach
    const genericResults = await extractGeneric(page, domains);
    if (genericResults.length > 0) {
      return genericResults;
    }

    // If no results found, return error with more context
    const errorMsg = resultsFound 
      ? 'No data found on page (selectors may need update)'
      : 'Page did not load results (timeout or structure changed)';
    
    return domains.map(domain => ({
      domain,
      monthlyVisits: null,
      avgSessionDuration: null,
      avgSessionDurationSeconds: null,
      bounceRate: null,
      pagesPerVisit: null,
      checkedAt: null,
      error: errorMsg,
    }));

  } catch (error) {
    console.error('Scraping error:', error);
    return domains.map(domain => ({
      domain,
      monthlyVisits: null,
      avgSessionDuration: null,
      avgSessionDurationSeconds: null,
      bounceRate: null,
      pagesPerVisit: null,
      growthRate: null,
      checkedAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extracts data from table format
 * Traffic.cv table columns: Website | Visits | Avg. Duration | Pages/Visit | Bounce Rate | Registration | Action
 */
async function extractFromTable(page: Page, domains: string[]): Promise<TrafficData[]> {
  try {
    // Look for table rows - try multiple selectors
    const rowSelectors = [
      'table tbody tr',
      '.table tbody tr',
      'table tr',
      '[role="row"]',
      'tr[data-domain]',
      'tbody > tr',
    ];

    let rows: any[] = [];
    for (const selector of rowSelectors) {
      rows = await page.$$(selector);
      if (rows.length > 0) break;
    }
    
    if (rows.length === 0) {
      return [];
    }

    // Get table headers to understand column order
    const headerRow = await page.$('table thead tr, table tr:first-child');
    let columnOrder: { visits?: number; duration?: number; pages?: number; bounce?: number } = {};
    
    if (headerRow) {
      const headers = await headerRow.$$('th, td');
      for (let i = 0; i < headers.length; i++) {
        const headerText = (await headers[i].textContent())?.toLowerCase() || '';
        if (headerText.includes('visit') && !headerText.includes('page')) {
          columnOrder.visits = i;
        } else if (headerText.includes('duration') || headerText.includes('avg')) {
          columnOrder.duration = i;
        } else if (headerText.includes('page')) {
          columnOrder.pages = i;
        } else if (headerText.includes('bounce')) {
          columnOrder.bounce = i;
        }
      }
    }

    const results: TrafficData[] = [];
    const domainMap = new Map<string, string>(); // normalized -> original
    for (const d of domains) {
      const normalized = d.toLowerCase().replace(/^www\./, '');
      domainMap.set(normalized, d);
      domainMap.set(`www.${normalized}`, d); // Also map www. version
    }

    for (const row of rows) {
      try {
        // Extract all cells
        const cells = await row.$$('td, th');
        if (cells.length === 0) continue;

        // Extract domain from first cell (Website column)
        const domainCell = cells[0];
        let domainText = await domainCell.textContent();
        if (!domainText || !domainText.trim()) continue;

        // Clean and normalize domain from table (same normalization as query)
        let domain = domainText.trim().toLowerCase();
        domain = domain.replace(/^https?:\/\//, '');
        domain = domain.replace(/^www\./, ''); // Remove www. for matching
        domain = domain.split('/')[0].split('?')[0].split('#')[0].split(' ')[0]; // Remove paths, query, and any trailing text
        domain = domain.replace(/\.+$/, ''); // Remove trailing dots
        
        // Match using normalized domain
        const matchedDomain = domainMap.get(domain);
        
        if (!matchedDomain) {
          // Try with www. prefix (in case traffic.cv returned it)
          const withWww = `www.${domain}`;
          const matchedWithWww = domainMap.get(withWww);
          if (matchedWithWww) {
            domain = matchedWithWww;
          } else {
            // Try fuzzy matching as last resort
            const found = domains.find(d => {
              let dNorm = d.toLowerCase().trim();
              dNorm = dNorm.replace(/^https?:\/\//, '');
              dNorm = dNorm.replace(/^www\./, '');
              dNorm = dNorm.split('/')[0].split('?')[0].split('#')[0];
              dNorm = dNorm.replace(/\.+$/, '');
              return dNorm === domain;
            });
            if (!found) continue;
            domain = found;
          }
        } else {
          domain = matchedDomain;
        }

        // Extract data from cells based on column order or by content
        const cellTexts: (string | null)[] = [];
        for (const cell of cells) {
          const text = await cell.textContent();
          cellTexts.push(text?.trim() || null);
        }

        // Extract monthly visits (usually 2nd column or contains K/M/B)
        let monthlyVisits: number | null = null;
        const visitsIndex = columnOrder.visits ?? 1; // Default to 2nd column
        if (cellTexts[visitsIndex]) {
          monthlyVisits = parseNumberWithSuffix(cellTexts[visitsIndex]);
        }
        if (!monthlyVisits) {
          // Fallback: search all cells
          for (const text of cellTexts) {
            if (text && (text.match(/[KMkmBb]/) || parseFloat(text) > 1000)) {
              const parsed = parseNumberWithSuffix(text);
              if (parsed && parsed > 100) {
                monthlyVisits = parsed;
                break;
              }
            }
          }
        }

        // Extract session duration (usually 3rd column or HH:MM:SS format)
        let avgSessionDuration: string | null = null;
        let avgSessionDurationSeconds: number | null = null;
        const durationIndex = columnOrder.duration ?? 2; // Default to 3rd column
        if (cellTexts[durationIndex] && cellTexts[durationIndex]!.match(/\d{2}:\d{2}:\d{2}/)) {
          avgSessionDuration = cellTexts[durationIndex]!.match(/\d{2}:\d{2}:\d{2}/)?.[0] || null;
          if (avgSessionDuration) {
            avgSessionDurationSeconds = parseDurationToSeconds(avgSessionDuration);
          }
        }
        if (!avgSessionDuration) {
          // Fallback: search for HH:MM:SS pattern
          for (const text of cellTexts) {
            if (text && text.match(/\d{2}:\d{2}:\d{2}/)) {
              avgSessionDuration = text.match(/\d{2}:\d{2}:\d{2}/)?.[0] || null;
              if (avgSessionDuration) {
                avgSessionDurationSeconds = parseDurationToSeconds(avgSessionDuration);
                break;
              }
            }
          }
        }

        // Extract pages per visit (usually 4th column or decimal between 0.1-20)
        let pagesPerVisit: number | null = null;
        const pagesIndex = columnOrder.pages ?? 3; // Default to 4th column
        if (cellTexts[pagesIndex]) {
          const parsed = parseFloat(cellTexts[pagesIndex]!);
          if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 20) {
            pagesPerVisit = parsed;
          }
        }
        if (pagesPerVisit === null) {
          // Fallback: search for decimal in reasonable range
          for (const text of cellTexts) {
            if (text) {
              const parsed = parseFloat(text);
              if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 20 && !text.includes('%') && !text.includes(':')) {
                pagesPerVisit = parsed;
                break;
              }
            }
          }
        }

        // Extract bounce rate (usually 5th column or contains %)
        let bounceRate: number | null = null;
        const bounceIndex = columnOrder.bounce ?? 4; // Default to 5th column
        if (cellTexts[bounceIndex] && cellTexts[bounceIndex]!.includes('%')) {
          bounceRate = parsePercentage(cellTexts[bounceIndex]);
        }
        if (bounceRate === null) {
          // Fallback: search for percentage
          for (const text of cellTexts) {
            if (text && text.includes('%')) {
              const parsed = parsePercentage(text);
              if (parsed !== null && parsed >= 0 && parsed <= 100) {
                bounceRate = parsed;
                break;
              }
            }
          }
        }

        results.push({
          domain,
          monthlyVisits,
          avgSessionDuration,
          avgSessionDurationSeconds,
          bounceRate,
          pagesPerVisit,
          checkedAt: null,
          error: null,
        });
      } catch (e) {
        // Skip this row if extraction fails
        console.error('Error extracting row:', e);
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Error in extractFromTable:', error);
    return [];
  }
}

/**
 * Extracts data from card format
 * Based on Traffic.cv's actual card structure with:
 * - Total Visits: "3.72K" or "4.57K"
 * - Avg. Duration: "00:14:24" or "00:00:16" (HH:MM:SS format)
 * - Pages per Visit: "3.13" or "1.68"
 * - Bounce Rate: "31.93%" or "46.38%"
 */
async function extractFromCards(page: Page, domains: string[]): Promise<TrafficData[]> {
  try {
    // Optimized: Look for card elements - prioritize most common selectors
    const cardSelectors = [
      '[class*="card"]',  // Most common
      'article',         // Semantic HTML
      '[class*="result"]',
      '[data-domain]',
    ];

    let cards: any[] = [];
    for (const selector of cardSelectors) {
      cards = await page.$$(selector);
      if (cards.length > 0) {
        break;
      }
    }
    
    if (cards.length === 0) {
      console.log('No cards found with primary selectors');
      return [];
    }

    const results: TrafficData[] = [];
    
    // Create mapping: normalized (no www, no protocol) -> original domain
    const domainMap = new Map<string, string>();
    for (const d of domains) {
      // Normalize for matching (same as what we sent to traffic.cv)
      let normalized = d.toLowerCase().trim();
      normalized = normalized.replace(/^https?:\/\//, '');
      normalized = normalized.replace(/^www\./, '');
      normalized = normalized.split('/')[0].split('?')[0].split('#')[0];
      normalized = normalized.replace(/\.+$/, '');
      
      // Map normalized to original
      domainMap.set(normalized, d);
      // Also map www. version to original (in case traffic.cv returns it)
      domainMap.set(`www.${normalized}`, d);
    }

    for (const card of cards) {
      try {
        // Get all text from the card - optimized: only get text once
        const cardText = await card.textContent();
        
        if (!cardText) continue;

        // Extract domain - look for domain name in the card
        // Domains are usually at the top, might be in a link, heading, or strong tag
        let domainText: string | null = null;
        const domainSelectors = [
          'a[href*="http"]',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          '[class*="domain"]',
          '[class*="title"]',
          'strong',
          'b',
          '[data-domain]',
        ];

        for (const sel of domainSelectors) {
          const element = await card.$(sel);
          if (element) {
            const text = await element.textContent();
            if (text) {
              // Check if this text contains any of our target domains
              const foundDomain = domains.find(d => 
                text.toLowerCase().includes(d.toLowerCase())
              );
              if (foundDomain) {
                domainText = foundDomain;
                break;
              }
            }
          }
        }

        // If no domain found via selectors, search in card text using normalized matching
        if (!domainText) {
          // Try to find domain by matching normalized versions
          for (const [normalized, original] of domainMap.entries()) {
            if (cardText.toLowerCase().includes(normalized) || 
                cardText.toLowerCase().includes(`www.${normalized}`)) {
              domainText = original;
              break;
            }
          }
        }

        if (!domainText) {
          // Debug: Log when domain not found in card
          console.log(`Domain not found in card text. Card preview: ${cardText.substring(0, 200)}...`);
          continue;
        }

        // Normalize domainText to match with our domain map
        let domain = domainText.trim().toLowerCase();
        domain = domain.replace(/^https?:\/\//, '');
        domain = domain.replace(/^www\./, ''); // Remove www. for matching
        domain = domain.split('/')[0].split('?')[0].split('#')[0].split(' ')[0];
        domain = domain.replace(/\.+$/, '');
        
        // Match using normalized domain
        const matchedDomain = domainMap.get(domain);
        
        if (!matchedDomain) {
          // Try with www. prefix (in case traffic.cv returned it)
          const withWww = `www.${domain}`;
          const matchedWithWww = domainMap.get(withWww);
          if (!matchedWithWww) {
            // Use original domainText if no match found
            domain = domainText;
          } else {
            domain = matchedWithWww;
          }
        } else {
          domain = matchedDomain;
        }

        // Extract "Total Visits" - optimized patterns, handle B (billion) suffix
        // Format: "Total Visits 82.28B" or "Total Visits: 3.72K" or "Total Visits4.57K"
        let monthlyVisits: number | null = null;
        const visitsPatterns = [
          /Total\s+Visits[:\s]+([\d.,]+\s*[KMkmBb]?)/i,
          /Total\s+Visits\s+([\d.,]+\s*[KMkmBb]?)/i,
          /Total\s+Visits([\d.,]+\s*[KMkmBb]?)/i,  // No space/colon
        ];

        for (const pattern of visitsPatterns) {
          const match = cardText.match(pattern);
          if (match && match[1]) {
            const parsed = parseNumberWithSuffix(match[1].trim());
            if (parsed && parsed > 0) {
              monthlyVisits = parsed;
              break;
            }
          }
        }

        // Context search if direct pattern fails
        if (!monthlyVisits) {
          const totalVisitsIndex = cardText.toLowerCase().indexOf('total visits');
          if (totalVisitsIndex !== -1) {
            const context = cardText.substring(totalVisitsIndex, Math.min(cardText.length, totalVisitsIndex + 50));
            const contextMatch = context.match(/([\d.,]+\s*[KMkmBb]?)/);
            if (contextMatch) {
              const parsed = parseNumberWithSuffix(contextMatch[1]);
              if (parsed && parsed > 0) {
                monthlyVisits = parsed;
              }
            }
          }
        }

        // Growth Rate extraction removed - feature not reliable
        const growthRate: number | null = null;

        // Extract "Avg. Duration" - format is "00:14:24" or "00:00:16" (HH:MM:SS)
        let avgSessionDuration: string | null = null;
        let avgSessionDurationSeconds: number | null = null;
        const durationPatterns = [
          /Avg\.?\s*Duration[:\s]+(\d{2}:\d{2}:\d{2})/i,
          /Duration[:\s]+(\d{2}:\d{2}:\d{2})/i,
          /(\d{2}:\d{2}:\d{2})/,
        ];

        for (const pattern of durationPatterns) {
          const match = cardText.match(pattern);
          if (match && match[1]) {
            avgSessionDuration = match[1];
            // Convert HH:MM:SS to seconds
            const parts = match[1].split(':').map(Number);
            if (parts.length === 3) {
              avgSessionDurationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
              break;
            }
          }
        }

        // Extract "Pages per Visit" - format is usually "3.13" or "1.68" or "8.62"
        // Look for "Pages per Visit" or "Pages/Visit" label - must be exact match
        let pagesPerVisit: number | null = null;
        const pagesPatterns = [
          /Pages\s+per\s+Visit[:\s]+([\d.]+)/i,
          /Pages\/Visit[:\s]+([\d.]+)/i,
          /Pages\s+per\s+Visit\s+([\d.]+)/i,
          /Pages\s+per\s+Visit([\d.]+)/i,  // No space/colon
        ];

        for (const pattern of pagesPatterns) {
          const match = cardText.match(pattern);
          if (match && match[1]) {
            const parsed = parseFloat(match[1]);
            // More restrictive: pages per visit should be between 0.1 and 20 (reasonable range)
            if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 20) {
              pagesPerVisit = parsed;
              break;
            }
          }
        }
        
        // Context search if direct pattern fails - be more precise
        if (pagesPerVisit === null) {
          const pagesIndex = cardText.toLowerCase().indexOf('pages per visit');
          if (pagesIndex === -1) {
            const pagesIndex2 = cardText.toLowerCase().indexOf('pages/visit');
            if (pagesIndex2 !== -1) {
              // Get text right after "Pages/Visit" (next 20 chars)
              const context = cardText.substring(pagesIndex2 + 10, Math.min(cardText.length, pagesIndex2 + 30));
              const pagesMatch = context.match(/^[:\s]*([\d.]+)/);
              if (pagesMatch) {
                const parsed = parseFloat(pagesMatch[1]);
                if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 20) {
                  pagesPerVisit = parsed;
                }
              }
            }
          } else {
            // Get text right after "Pages per Visit" (next 20 chars)
            const context = cardText.substring(pagesIndex + 15, Math.min(cardText.length, pagesIndex + 35));
            const pagesMatch = context.match(/^[:\s]*([\d.]+)/);
            if (pagesMatch) {
              const parsed = parseFloat(pagesMatch[1]);
              if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 20) {
                pagesPerVisit = parsed;
              }
            }
          }
        }

        // Extract "Bounce Rate" - format is "31.93%" or "46.38%"
        // Look for "Bounce Rate" label followed by percentage
        let bounceRate: number | null = null;
        const bouncePatterns = [
          /Bounce\s+Rate[:\s]+([\d.]+)%/i,
          /Bounce\s+Rate\s+([\d.]+)%/i,
          /Bounce\s+Rate([\d.]+)%/i,  // No space/colon
        ];

        for (const pattern of bouncePatterns) {
          const match = cardText.match(pattern);
          if (match && match[1]) {
            const parsed = parsePercentage(match[1]);
            if (parsed !== null && parsed >= 0 && parsed <= 100) {
              bounceRate = parsed;
              break;
            }
          }
        }

        // Context search if direct pattern fails
        if (bounceRate === null) {
          const bounceIndex = cardText.toLowerCase().indexOf('bounce rate');
          if (bounceIndex === -1) {
            const bounceIndex2 = cardText.toLowerCase().indexOf('bounce');
            if (bounceIndex2 !== -1) {
              const context = cardText.substring(bounceIndex2, Math.min(cardText.length, bounceIndex2 + 40));
              const bounceMatch = context.match(/([\d.]+)%/);
              if (bounceMatch) {
                const parsed = parsePercentage(bounceMatch[1]);
                if (parsed !== null && parsed >= 0 && parsed <= 100) {
                  bounceRate = parsed;
                }
              }
            }
          } else {
            const context = cardText.substring(bounceIndex, Math.min(cardText.length, bounceIndex + 40));
            const bounceMatch = context.match(/([\d.]+)%/);
            if (bounceMatch) {
              const parsed = parsePercentage(bounceMatch[1]);
              if (parsed !== null && parsed >= 0 && parsed <= 100) {
                bounceRate = parsed;
              }
            }
          }
        }

        // Only add result if we found at least the domain and one metric
        if (domain && (monthlyVisits !== null || avgSessionDuration !== null)) {
          // Extract historical months data (optional, non-blocking for speed)
          // Only extract if we have time - don't wait too long
          let historicalMonths: HistoricalMonthData[] = [];
          try {
            // Use Promise.race to limit historical extraction time to 2s max
            historicalMonths = await Promise.race([
              extractHistoricalMonths(page, domain),
              new Promise<HistoricalMonthData[]>((resolve) => 
                setTimeout(() => resolve([]), 2000) // Timeout after 2s
              ),
            ]);
          } catch (error) {
            // Silently fail - historical data is optional
          }

          results.push({
            domain,
            monthlyVisits,
            avgSessionDuration,
            avgSessionDurationSeconds,
            bounceRate,
            pagesPerVisit,
            checkedAt: null,
            error: null,
            // Store historical months data for later storage
            historicalMonths: historicalMonths.length > 0 ? historicalMonths : undefined,
          } as TrafficData & { historicalMonths?: HistoricalMonthData[] });
        }
      } catch (e) {
        // Skip this card if extraction fails
        console.error('Error extracting card:', e);
        continue;
      }
    }

    console.log(`Extracted ${results.length} results from cards (expected ${domains.length} domains)`);
    
    // Debug: Log which domains were found vs expected
    const foundDomains = new Set(results.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
    const missingDomains = domains.filter(d => {
      const dNorm = d.toLowerCase().replace(/^www\./, '');
      return !foundDomains.has(dNorm);
    });
    if (missingDomains.length > 0) {
      console.log(`Missing domains in card extraction: ${missingDomains.join(', ')}`);
    }
    
    return results;
  } catch (error) {
    console.error('Error in extractFromCards:', error);
    return [];
  }
}

/**
 * Generic extraction that searches the entire page for domain data
 */
async function extractGeneric(page: Page, domains: string[]): Promise<TrafficData[]> {
  try {
    const results: TrafficData[] = [];
    const pageText = await page.textContent('body');
    
    if (!pageText) return [];

    for (const domain of domains) {
      // Search for domain in page text
      const domainRegex = new RegExp(domain.replace(/\./g, '\\.'), 'i');
      if (!domainRegex.test(pageText)) continue;

      // Try to find data near the domain mention
      const domainIndex = pageText.toLowerCase().indexOf(domain.toLowerCase());
      if (domainIndex === -1) continue;

      // Extract context around domain (500 chars before and after)
      const start = Math.max(0, domainIndex - 500);
      const end = Math.min(pageText.length, domainIndex + domain.length + 500);
      const context = pageText.substring(start, end);

      // Try to extract metrics from context
      const visitsMatch = context.match(/([\d.,]+\s*[KMkm]?)\s*(visits|monthly|traffic)/i);
      const monthlyVisits = visitsMatch ? parseNumberWithSuffix(visitsMatch[1]) : null;

      const durationMatch = context.match(/(\d+[hms]\s*)+|(\d+:\d+)/i);
      const avgSessionDuration = durationMatch ? durationMatch[0].trim() : null;
      const avgSessionDurationSeconds = parseDurationToSeconds(durationMatch ? durationMatch[0] : null);

      const bounceMatch = context.match(/([\d.]+)%/);
      const bounceRate = bounceMatch ? parsePercentage(bounceMatch[0]) : null;

      // Only add if we found at least one metric
      if (monthlyVisits || avgSessionDuration) {
        results.push({
          domain,
          monthlyVisits,
          avgSessionDuration,
          avgSessionDurationSeconds,
          bounceRate,
          pagesPerVisit: null,
 // Will be calculated from historical data
          checkedAt: null,
          error: null,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in extractGeneric:', error);
    return [];
  }
}

/**
 * Generates mock data for dry-run mode
 */
function generateMockData(domains: string[]): TrafficData[] {
  return domains.map((domain, index) => {
    const baseVisits = [10000, 50000, 200000, 1000000, 5000000][index % 5];
    const visits = baseVisits * (1 + Math.random());
    const durationMinutes = Math.floor(Math.random() * 5) + 1;
    const durationSeconds = Math.floor(Math.random() * 60);

    return {
      domain,
      monthlyVisits: Math.round(visits),
      avgSessionDuration: `${durationMinutes}m ${durationSeconds}s`,
      avgSessionDurationSeconds: durationMinutes * 60 + durationSeconds,
      bounceRate: Math.round((Math.random() * 40 + 30) * 10) / 10,
      pagesPerVisit: Math.round((Math.random() * 3 + 2) * 10) / 10,
      checkedAt: null,
      error: null,
    };
  });
}

