/**
 * Parse embedded traffic.cv Next.js flight chunks from HTML.
 * Mirrors YC Mode enrich_trafficcv.mjs — label-anchored, not DOM-order dependent.
 */

export interface TrafficCvRaw {
  overview?: {
    visits?: number;
    bounceRate?: number;
    timeOnSite?: number;
    pagePerVisit?: number;
    globalRank?: number;
    countryRank?: number;
  };
  monthlyVisits?: Record<string, number>;
  trafficSources?: Record<string, number>;
  topCountries?: Array<Record<string, unknown>>;
  topKeywords?: Array<Record<string, unknown>>;
  whois?: Record<string, unknown>;
  domainAgeDays?: number;
}

function findJsonObject(text: string, marker: string): string | null {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = text.indexOf('{', markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function decodeFlightChunks(html: string): string {
  const chunks: string[] = [];
  const pattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;

  for (const match of html.matchAll(pattern)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`));
    } catch {
      // Truncated chunks happen on streaming responses — keep scanning.
    }
  }

  return chunks.join('');
}

export function parseTrafficObjectFromHtml(html: string): TrafficCvRaw | null {
  const flightText = decodeFlightChunks(html);
  const normal = findJsonObject(flightText || html, '"traffic":');
  if (normal) return JSON.parse(normal) as TrafficCvRaw;

  const escaped = findJsonObject(html, '\\"traffic\\":');
  if (!escaped) return null;

  const jsonText = escaped
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\\n')
    .replace(/\\r/g, '\\r')
    .replace(/\\t/g, '\\t');

  return JSON.parse(jsonText) as TrafficCvRaw;
}
