/**
 * API route for updating results after background scraping
 * GET /api/traffic/update?domains=domain1,domain2
 * 
 * Polls for updated results after background scraping completes
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDomains } from '@/lib/domain-utils';
import { getLatestTrafficDataBatch, isDataFresh } from '@/lib/db';
import { TrafficData } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const domainsParam = searchParams.get('domains');
    
    if (!domainsParam) {
      return NextResponse.json(
        { error: 'domains parameter required' },
        { status: 400 }
      );
    }

    const domains = domainsParam.split(',').map(d => d.trim()).filter(Boolean);
    
    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No valid domains provided' },
        { status: 400 }
      );
    }

    // Normalize domains
    const normalized = normalizeDomains(domains);
    const normalizedDomains = normalized.map(d => d.domain);

    // Get latest data from database
    const dbData = getLatestTrafficDataBatch(normalizedDomains);
    const results: TrafficData[] = [];

    for (const [domain, data] of dbData.entries()) {
      // Ensure avgSessionDuration is formatted
      let formattedDuration = data.avgSessionDuration;
      if (!formattedDuration && data.avgSessionDurationSeconds !== null && data.avgSessionDurationSeconds !== undefined) {
        const seconds = data.avgSessionDurationSeconds;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        formattedDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      results.push({
        ...data,
        avgSessionDuration: formattedDuration,
      });
    }

    // For domains not in database, return placeholder
    for (const domain of normalizedDomains) {
      if (!dbData.has(domain)) {
        results.push({
          domain,
          monthlyVisits: null,
          avgSessionDuration: null,
          avgSessionDurationSeconds: null,
          bounceRate: null,
          pagesPerVisit: null,
          checkedAt: null,
          error: 'Still scraping...',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Update API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

