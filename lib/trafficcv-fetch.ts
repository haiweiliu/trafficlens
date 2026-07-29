/**
 * High-fidelity traffic.cv fetch via Sovereign CF worker proxy.
 * Avoids Playwright + datacenter Cloudflare blocks; parses flight chunks directly.
 */

import { TrafficData } from '@/types';
import { parseTrafficObjectFromHtml, TrafficCvRaw } from './trafficcv-flight-parser';

const DEFAULT_PROXY_URL =
  process.env.TRAFFIC_CV_PROXY_URL ||
  process.env.TRAFFIC_PROXY_URL ||
  'https://backlink-savage-proxy.mingcomco.workers.dev';

const FETCH_DELAY_MS = Math.max(2000, Number(process.env.TRAFFICCV_FETCH_DELAY_MS || 2000));
const FETCH_TIMEOUT_MS = Math.max(8000, Number(process.env.TRAFFICCV_FETCH_TIMEOUT_MS || 25000));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDomain(domain: string): string {
  let normalized = domain.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.split('/')[0].split('?')[0].split('#')[0];
  return normalized.replace(/\.+$/, '');
}

function normalizeBounceRate(bounceRate: number): number {
  if (!Number.isFinite(bounceRate) || bounceRate <= 0) return 0;
  let pct = bounceRate;
  while (pct > 100) pct /= 100;
  if (pct <= 1) pct *= 100;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}

function percent(value: number): number {
  return Math.round(Number(value || 0) * 1000) / 10;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normalizeTrafficSources(sources: Record<string, number> = {}): Record<string, number> {
  const social = percent(Number(sources.socialOrganic || 0) + Number(sources.socialPaid || 0));
  const search = percent(Number(sources.searchOrganic || 0) + Number(sources.searchPaid || 0));
  const referrals = percent(Number(sources.referrals || 0) + Number(sources.affiliate || 0));
  const direct = percent(sources.direct || 0);
  const mail = percent(sources.mail || 0);
  const display = percent(sources.displayAds || 0);
  const known = search + direct + social + mail + referrals + display;
  const other = Math.max(0, Math.round((100 - known) * 10) / 10);

  return { search, direct, social, mail, referrals, display, other };
}

export function trafficCvRawToTrafficData(domain: string, traffic: TrafficCvRaw): TrafficData | null {
  const visits = Number(traffic.overview?.visits || 0);
  if (!visits) return null;

  const avgDurationSeconds = Math.round(Number(traffic.overview?.timeOnSite || 0));
  const sources = normalizeTrafficSources(traffic.trafficSources || {});

  return {
    domain,
    monthlyVisits: visits,
    avgSessionDuration: avgDurationSeconds > 0 ? formatDuration(avgDurationSeconds) : null,
    avgSessionDurationSeconds: avgDurationSeconds > 0 ? avgDurationSeconds : null,
    bounceRate: normalizeBounceRate(Number(traffic.overview?.bounceRate || 0)),
    pagesPerVisit: Math.round(Number(traffic.overview?.pagePerVisit || 0) * 100) / 100 || null,
    checkedAt: new Date().toISOString(),
    trafficSources: sources,
    error: null,
  };
}

async function fetchTrafficCvHtml(domain: string): Promise<string> {
  const normalized = normalizeDomain(domain);
  const target = `https://traffic.cv/${encodeURIComponent(normalized)}`;
  const proxyBase = DEFAULT_PROXY_URL.replace(/\/$/, '');
  const url = `${proxyBase}/${target}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        accept: 'text/html,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`traffic.cv proxy ${response.status}`);
    }

    const html = await response.text();
    if (html.includes('Just a moment') && !html.includes('"traffic":')) {
      throw new Error('traffic.cv cloudflare challenge');
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTrafficCvDomain(domain: string): Promise<TrafficData> {
  const normalized = normalizeDomain(domain);

  try {
    const html = await fetchTrafficCvHtml(normalized);
    const traffic = parseTrafficObjectFromHtml(html);

    if (!traffic) {
      return {
        domain: normalized,
        monthlyVisits: null,
        avgSessionDuration: null,
        avgSessionDurationSeconds: null,
        bounceRate: null,
        pagesPerVisit: null,
        checkedAt: new Date().toISOString(),
        trafficSources: null,
        error: 'traffic.cv data object not found',
      };
    }

    const parsed = trafficCvRawToTrafficData(normalized, traffic);
    if (parsed) return parsed;

    return {
      domain: normalized,
      monthlyVisits: 0,
      avgSessionDuration: null,
      avgSessionDurationSeconds: null,
      bounceRate: null,
      pagesPerVisit: null,
      checkedAt: new Date().toISOString(),
      trafficSources: null,
      error: null,
    };
  } catch (error) {
    return {
      domain: normalized,
      monthlyVisits: null,
      avgSessionDuration: null,
      avgSessionDurationSeconds: null,
      bounceRate: null,
      pagesPerVisit: null,
      checkedAt: new Date().toISOString(),
      trafficSources: null,
      error: error instanceof Error ? error.message : 'traffic.cv fetch failed',
    };
  }
}

/**
 * Fetch multiple domains sequentially via proxy (2s delay between requests).
 */
export async function fetchTrafficCvBatch(domains: string[]): Promise<TrafficData[]> {
  const results: TrafficData[] = [];

  for (let index = 0; index < domains.length; index++) {
    if (index > 0) await sleep(FETCH_DELAY_MS);
    results.push(await fetchTrafficCvDomain(domains[index]));
  }

  return results;
}

export function isCompleteTrafficResult(result: TrafficData): boolean {
  if (result.error && result.error !== 'Scraping in background...') return true;
  return result.monthlyVisits !== null && result.monthlyVisits !== undefined;
}
