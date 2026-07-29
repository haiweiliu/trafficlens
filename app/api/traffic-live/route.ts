import { NextRequest, NextResponse } from 'next/server';
import { fetchTrafficCvDomain } from '@/lib/trafficcv-fetch';
import { storeTrafficData, getLatestTrafficData, isDataFresh } from '@/lib/db';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
  }

  try {
    const cachedData = getLatestTrafficData(domain);
    if (cachedData && isDataFresh(domain, 30)) {
      return NextResponse.json(cachedData);
    }

    const result = await fetchTrafficCvDomain(domain);

    if (result.monthlyVisits !== null && result.monthlyVisits !== undefined) {
      try {
        storeTrafficData(result);
      } catch (dbErr) {
        console.error('[Live Request] DB storage error:', dbErr);
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: result.error || 'No data returned from scraper' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[Live Request] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
