/**
 * API route for trend analysis
 * GET /api/trends?domain=example.com&period=3m
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalData, calculateTrends } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get('domain');
    const period = searchParams.get('period') || '12m';

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parameter required' },
        { status: 400 }
      );
    }

    // Get historical data
    const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const historical = getHistoricalData(domain, months);

    // Calculate trends
    const trends = calculateTrends(domain);

    return NextResponse.json({
      domain,
      period,
      historical,
      trends,
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

