/**
 * Admin heal endpoint — purge incomplete cache + warm canary domains.
 * POST /api/heal
 * Header: x-trafficlens-admin-key: $TRAFFICLENS_ADMIN_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { purgeIncompleteTrafficCache, storeTrafficData } from '@/lib/db';
import { scrapeTrafficData } from '@/lib/scraper';

export const maxDuration = 300;

const CANARY_DOMAINS = (process.env.TRAFFICLENS_CANARY_DOMAINS || 'threads.com,github.com,google.com')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.TRAFFICLENS_ADMIN_KEY;
  if (!expected) return false;
  const provided = request.headers.get('x-trafficlens-admin-key');
  return provided === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const purged = purgeIncompleteTrafficCache();
    console.log(`[Heal] Purged ${purged} incomplete cache rows`);

    const warmed = await scrapeTrafficData(CANARY_DOMAINS.slice(0, 3), false);

    for (const row of warmed) {
      if (row.domain) storeTrafficData(row);
    }

    const withVisits = warmed.filter(
      (row) => row.monthlyVisits !== null && row.monthlyVisits !== undefined
    ).length;

    return NextResponse.json({
      ok: withVisits >= Math.ceil(CANARY_DOMAINS.length * 0.66),
      purged,
      canaries: CANARY_DOMAINS.slice(0, 3),
      warmed: withVisits,
      total: warmed.length,
      results: warmed,
    });
  } catch (error) {
    console.error('[Heal] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Heal failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'trafficlens-heal',
    canaries: CANARY_DOMAINS,
    authorized: Boolean(process.env.TRAFFICLENS_ADMIN_KEY),
  });
}
