/**
 * Playwright-based scraper for Traffic.cv bulk traffic checker
 * Supports both Vercel (serverless) and Railway (full filesystem)
 */

import { Browser, Page } from 'playwright';
import { parseNumberWithSuffix, parseDurationToSeconds, parsePercentage } from './parsing-utils';
import { TrafficData } from '@/types';
import { extractHistoricalMonths, HistoricalMonthData } from './historical-extractor';
import path from 'path';
import fs from 'fs';

// Ensure a local temp directory exists to avoid EPERM in /var/folders on macOS
const LOCAL_TMP = path.join(process.cwd(), '.playwright_tmp');
if (!fs.existsSync(LOCAL_TMP)) {
  fs.mkdirSync(LOCAL_TMP, { recursive: true });
}
process.env.TMPDIR = LOCAL_TMP;

/**
 * Get the appropriate Chromium browser launcher based on environment
 * - Vercel: Uses @sparticuz/chromium (serverless-compatible)
 * - Railway/Local: Uses regular Playwright (full filesystem access)
 */
async function getChromiumBrowser(proxyConfig?: { server: string; username?: string; password?: string } | null) {
  const isVercel = !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_URL
  );

  if (isVercel) {
    // Vercel: Use serverless-compatible Chromium
    const { chromium } = await import('playwright-core');
    const Chromium = (await import('@sparticuz/chromium')).default;

    const args = [...Chromium.args];
    // FORCE DIRECT if explicit null is passed (meaning "no proxy please")
    // proxyConfig === undefined means "use defaults" (if we had any for Vercel, which we don't usually)
    // proxyConfig === null means "direct connection"
    if (proxyConfig === null) {
      args.push('--no-proxy-server');
    }

    return chromium.launch({
      headless: true,
      executablePath: await Chromium.executablePath(),
      args,
      proxy: proxyConfig || undefined,
    });
  } else {
    // Railway/Local: Use regular Playwright
    const { chromium } = await import('playwright');
    const userDataDir = path.join(LOCAL_TMP, 'user_data_global');

    // Determine proxy settings
    let proxyServer = process.env.PROXY_URL;
    let proxyUsername = process.env.PROXY_USERNAME;
    let proxyPassword = process.env.PROXY_PASSWORD;
    const proxyscrapeKey = process.env.PROXYSCRAPE_API_KEY;

    // IF proxyConfig is explicitly provided (not null/undefined), use it
    if (proxyConfig) {
      // It's a custom proxy object
      return chromium.launch({
        headless: true,
        proxy: proxyConfig,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          `--user-data-dir=${path.join(LOCAL_TMP, 'user_data_' + Date.now())}`
        ]
      });
    }

    // IF proxyConfig is explicit NULL, it means "Force Direct / No Proxy"
    if (proxyConfig === null) {
      return chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-site-isolation-trials', // Aggressive memory saving
          '--js-flags="--max-old-space-size=512"', // Limit V8 memory
          '--no-proxy-server' // <--- CRITICAL FIX
        ]
      });
    }

    // OTHERWISE (undefined): Apply Defaults (PyProxy / ProxyScrape)

    // Default to PyProxy Sticky IP if no manual proxy is set
    // WE USE STICKY IP (Session) for better speed/success rate, with random session ID to avoid collisions
    // NUCLEAR DIRECT DIAGNOSIS: Disable all proxy fetching
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--no-proxy-server' // FORCE DIRECT
    ];

    console.log('DIAGNOSTIC: Running in Force Direct Mode (No Proxy)');
    return chromium.launch({
      headless: true,
      args: [...baseArgs, `--user-data-dir=${path.join(LOCAL_TMP, 'user_data_direct_' + Date.now())}`]
    });
  }
}

// Global singleton browser instance to avoid recreating Playwright per batch
// Drastically saves threads (prevents pthread_create SIGTRAP) on Railway
let globalBrowser: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

// Browser Bomb Protection: Ensure only ONE scraping operation happens at a time
// to prevent CPU saturation (350% orbit) and zombie thread pile-up.
let isScrapingLocked = false;
const lockQueue: (() => void)[] = [];

async function acquireScrapingLock(): Promise<void> {
  if (!isScrapingLocked) {
    isScrapingLocked = true;
    return;
  }
  return new Promise(resolve => lockQueue.push(resolve));
}

function releaseScrapingLock() {
  const next = lockQueue.shift();
  if (next) {
    next();
  } else {
    isScrapingLocked = false;
  }
}

async function getSharedBrowser(proxyConfig?: any): Promise<Browser> {
  if (globalBrowser && globalBrowser.isConnected()) {
    return globalBrowser;
  }

  if (browserLaunchPromise) {
    const b = await browserLaunchPromise;
    if (b.isConnected()) return b;
  }

  browserLaunchPromise = getChromiumBrowser(proxyConfig);
  try {
    globalBrowser = await browserLaunchPromise;
    return globalBrowser;
  } catch (error) {
    browserLaunchPromise = null;
    globalBrowser = null;
    throw error;
  }
}

/**
 * Scrapes traffic data from Traffic.cv bulk endpoint
 * @param domains Array of domains (max 10 per call)
 * @param dryRun If true, returns mock data without scraping
 * @param useProxy If true, uses Default Proxy (PyProxy/Env). If false, forces DIRECT.
 * @param customProxy Optional custom proxy configuration
 */
export async function scrapeTrafficData(
  domains: string[],
  dryRun: boolean = false,
  useProxy: boolean = true, // Default to using proxy in prod, but allow opt-out
  customProxy?: { server: string; username?: string; password?: string }
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

  // Acquire concurrency lock (Browser Bomb protection)
  await acquireScrapingLock();

  try {
    // Hard Safety Timeout: 45 seconds total for the entire operation
    // If Playwright hangs internally, this ensures we close the context and release the lock.
    const SAFETY_TIMEOUT_MS = 45000;
    
    return await Promise.race([
      performScrape(domains, useProxy, customProxy),
      new Promise<TrafficData[]>((_, reject) => 
        setTimeout(() => reject(new Error('SCRAPER_SAFETY_TIMEOUT: Operation exceeded 45s hard limit')), SAFETY_TIMEOUT_MS)
      )
    ]);
  } finally {
    // CRITICAL: Always release the lock
    releaseScrapingLock();
  }
}

/**
 * Internal function that performs the actual scrape
 * Separated to allow Promise.race with a safety timeout
 */
async function performScrape(
  domains: string[],
  useProxy: boolean,
  customProxy?: { server: string; username?: string; password?: string }
): Promise<TrafficData[]> {
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
  let context: any = null;

  try {
    // Launch Chromium browser (auto-detects Vercel vs Railway/Local)
    let proxyArg: { server: string; username?: string; password?: string } | null | undefined;

    if (customProxy) {
      proxyArg = customProxy;
    } else if (!useProxy) {
      proxyArg = null; // Signal to force direct
    } else {
      proxyArg = undefined; // Signal to use defaults
    }

    browser = await getSharedBrowser(proxyArg);

    // Create a new context per page request, not a full browser
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Optimize: Block unnecessary resources for faster loading
    await page.route('**/*', (route: any) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'websocket', 'manifest', 'other'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Optimize: Reduced timeouts for faster processing
    page.setDefaultTimeout(20000); // 20s

    // Navigate to the bulk checker page
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Quick check for "No valid data" - ONLY for single domain queries
    if (domains.length === 1) {
      await page.waitForTimeout(1000); 
      const quickCheckText = await page.textContent('body').catch(() => '');
      const pageHTML = await page.content().catch(() => '');
      const allText = (quickCheckText + ' ' + pageHTML).toLowerCase();

      const hasNoDataMessage = allText.includes('no valid data') ||
        allText.includes('unregistered domain') ||
        allText.includes('not registered') ||
        allText.includes('data is unavailable') ||
        allText.includes('this domain is not registered');

      if (hasNoDataMessage && !allText.includes('total visits') && !allText.includes('monthly')) {
        console.log(`Quick detection: Single domain shows "No valid data" - returning early`);
        return domains.map(domain => ({
          domain,
          monthlyVisits: 0,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: new Date().toISOString(),
          error: null,
        }));
      }
    } else {
      await page.waitForTimeout(500);
    }

    let resultsFound = false;
    const possibleSelectors = [
      '[class*="card"]',
      'table',
      '[class*="result"]',
      '[class*="domain"]',
    ];

    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 }); 
        resultsFound = true;
        break;
      } catch (e) { }
    }

    const isRailway = !!(
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_SERVICE_NAME ||
      process.env.RAILWAY_PROJECT_ID
    );
    const baseWaitTime = isRailway ? 6000 : 3000;

    if (resultsFound) {
      await page.waitForTimeout(baseWaitTime);

      try {
        const verificationTimeout = isRailway ? 15000 : 5000;
        const expectedCount = domains.length;
        const isRailwayEnv = isRailway;

        await page.evaluate(({ expectedCount, isRailwayEnv }: { expectedCount: number, isRailwayEnv: boolean }) => {
          (window as any).__expectedCount = expectedCount;
          (window as any).__isRailwayEnv = isRailwayEnv;
        }, { expectedCount, isRailwayEnv });

        await page.waitForFunction(
          () => {
            const cards = document.querySelectorAll('[class*="card"], table tbody tr, [class*="result"]');
            let cardsWithData = 0;
            for (const card of cards) {
              const text = card.textContent || '';
              if (text.length > 20 &&
                text.match(/[a-z0-9]+\.[a-z]{2,}/i) &&
                (text.match(/[\d.,]+\s*[KMkmBb]/i) ||
                  text.match(/\d{2}:\d{2}:\d{2}/) ||
                  text.match(/[\d.]+%/))) {
                cardsWithData++;
              }
            }
            const expectedCount = (window as any).__expectedCount || 10;
            const isRailwayEnv = (window as any).__isRailwayEnv || false;
            const minRequired = isRailwayEnv
              ? Math.max(2, Math.floor(expectedCount * 0.8))
              : Math.min(2, cards.length);
            return cardsWithData >= minRequired;
          },
          { timeout: verificationTimeout }
        ).catch(() => {
          console.log('Content verification timeout, proceeding anyway');
        });

        if (isRailway) {
          await page.waitForTimeout(3000);
        }
      } catch (e) {
        console.log('Content verification failed, proceeding anyway');
      }
    } else {
      await page.waitForTimeout(isRailway ? 10000 : 5000);
    }

    console.log(`Page loaded: ${url}`);

    let tableResults = await extractFromTable(page, domains);
    if (tableResults.length > 0) {
      if (isRailway && tableResults.length < domains.length * 0.8) {
        await page.waitForTimeout(5000);
        tableResults = await extractFromTable(page, domains);
      }

      const foundDomains = new Set(tableResults.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
      const missingDomains = domains.filter(d => {
        const dNorm = d.toLowerCase().replace(/^www\./, '');
        return !foundDomains.has(dNorm);
      });

      const pageText = await page.textContent('body') || '';
      for (const domain of missingDomains) {
        const domainNorm = domain.toLowerCase().replace(/^www\./, '');
        const domainOnPage = pageText.toLowerCase().includes(domainNorm);

        if (domainOnPage) {
          tableResults.push({
            domain,
            monthlyVisits: 0,
            avgSessionDuration: null,
            avgSessionDurationSeconds: null,
            bounceRate: null,
            pagesPerVisit: null,
            checkedAt: null,
            error: null,
          });
        } else {
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
      }
      return tableResults;
    }

    let cardResults = await extractFromCards(page, domains);
    if (cardResults.length > 0) {
      if (isRailway && cardResults.length < domains.length * 0.8) {
        await page.waitForTimeout(5000);
        cardResults = await extractFromCards(page, domains);
      }

      const foundDomains = new Set(cardResults.map(r => r.domain.toLowerCase().replace(/^www\./, '')));
      const missingDomains = domains.filter(d => {
        const dNorm = d.toLowerCase().replace(/^www\./, '');
        return !foundDomains.has(dNorm);
      });

      const pageText = await page.textContent('body') || '';
      const pageHTML = await page.content();

      for (const domain of missingDomains) {
        const domainNorm = domain.toLowerCase().replace(/^www\./, '');
        const domainVariations = [domainNorm, `www.${domainNorm}`, domain.toLowerCase(), domain];

        let domainOnPage = false;
        for (const variation of domainVariations) {
          if (pageText.toLowerCase().includes(variation.toLowerCase()) ||
            pageHTML.toLowerCase().includes(variation.toLowerCase())) {
            domainOnPage = true;
            break;
          }
        }

        if (domainOnPage) {
          await page.waitForTimeout(2000);
          const retryResults = await extractFromCards(page, [domain]);
          if (retryResults.length > 0 && !retryResults[0].error) {
            cardResults.push(retryResults[0]);
          } else {
            cardResults.push({
              domain,
              monthlyVisits: 0,
              avgSessionDuration: null,
              avgSessionDurationSeconds: null,
              bounceRate: null,
              pagesPerVisit: null,
              checkedAt: null,
              error: null,
            });
          }
        } else {
          cardResults.push({
            domain,
            monthlyVisits: null,
            avgSessionDuration: null,
            avgSessionDurationSeconds: null,
            bounceRate: null,
            pagesPerVisit: null,
            checkedAt: null,
            error: 'No data found on page (selectors may need update)',
          });
        }
      }
      return cardResults;
    }

    const genericResults = await extractGeneric(page, domains);
    if (genericResults.length > 0) {
      return genericResults;
    }

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
      checkedAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  } finally {
    if (context) {
      await context.close().catch(() => { });
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
              // Check if this text contains any of our target domains using robust regex
              const foundDomain = domains.find(d => {
                const normalizedSearch = d.toLowerCase().replace(/^www\./, '').replace(/\./g, '\\.');
                const regex = new RegExp(normalizedSearch + '(\\b|[^a-z0-9]|$)', 'i');
                return regex.test(text);
              });
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
            const regex = new RegExp(normalized.replace(/\./g, '\\.') + '(\\b|[^a-z0-9]|$)', 'i');
            if (regex.test(cardText)) {
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

