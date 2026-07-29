/**
 * Lightweight liveness probe for Railway / uptime monitors.
 * GET /api/health — no Playwright, no scrape, no admin auth.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'trafficlens',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
