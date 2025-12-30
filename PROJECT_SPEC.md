# Traffic Bulk Extractor - Project Specification

## Overview

**Traffic Bulk Extractor** is an MVP web tool that estimates website traffic by scraping Traffic.cv's Bulk Traffic Checker UI. The tool allows users to input multiple domains and retrieve traffic metrics in bulk, with support for exporting data to spreadsheets.

## Goal

- **Input**: A list of domains (one per line OR comma-separated OR pasted from spreadsheet)
- **Output** (in a table + export):
  - Domain
  - Monthly Visits (MV) - Traffic Volume / Monthly visitors equivalent
  - Avg Session Duration
  - (Optional) Bounce Rate, Pages/Visit if available
  - Timestamp (run date)
- Must support bulk runs monthly for many domains with minimal cost (no paid API)
- One-click "Copy as TSV" (for Google Sheets) and "Download CSV"

## Core Data Source & Constraint

- **Use Traffic.cv bulk endpoint**: `https://traffic.cv/bulk?domains=domain1.com,domain2.com`
- **Free batch limit**: 10 domains per session; implement automatic batching for larger lists
- **Traffic.cv bulk page is JS-rendered**: HTML fetch shows "Loading data…"
  - Therefore use **Playwright** to render and extract the populated table/cards

## Tech Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind**
- **Server route**: `/api/traffic` (POST)
- **Playwright** in the server environment to:
  1. Launch chromium headless
  2. Visit bulk URL with up to 10 domains
  3. Wait for the results table/cards to populate (no "Loading data...")
  4. Extract metrics per domain from DOM
  5. Return JSON to frontend
- **In-memory cache** (Map) keyed by domain+month to avoid repeated runs
- **Rate limiting** to avoid hammering the site (e.g., 1 batch per 3–5 seconds)

## UI / UX Requirements

Single page, minimal layout:

- **Textarea**: "Paste domains"
- **Helpers**: "Normalize" button (dedupe, strip protocols, remove paths, lowercase)
- **"Run" button** + progress indicator: "Batch 2/7 running…"
- **Results table** with sortable columns (MV desc default)
- **Buttons**:
  - Copy TSV
  - Download CSV
  - Clear

### Output Format

Output should be ready to paste into Google Sheets.

**TSV header**: `Domain \t MonthlyVisits \t AvgSessionDuration \t CheckedAt`

## Parsing Requirements

Implement robust DOM extraction:

- Prefer table view if present; fallback to card view
- For each row/card identify:
  - domain
  - monthly visits (normalize 12.3K / 4.5M -> integer)
  - avg session duration (normalize "mm:ss" or "xh ym" into seconds + keep original string)
- If a domain is missing data, return nulls + an error field per domain

## Batching Rules

- If user inputs >10 domains:
  - Split into chunks of 10
  - Run sequentially with delay
  - Merge results in original domain order
- Show per-batch errors but continue other batches

## Copy / Export

- **Copy TSV**: Writes to clipboard using `navigator.clipboard.writeText`
- **Download CSV**: Created client-side from results

## Safety / Compliance

- Add a visible note:
  > "This tool fetches publicly visible estimates from traffic.cv. Please respect their Terms/limits."
- Implement a User-Agent header in Playwright context
- Avoid aggressive concurrency

## Implementation Steps

1. **Scaffold Next.js app** with a single page
2. **Build domain normalization utilities** + tests
3. **Implement `/api/traffic`**:
   - validate input domains
   - chunk into 10
   - Playwright scrape function (extractor)
   - caching + rate limiting
4. **Frontend**: run batches, render table, copy/export
5. **Provide README** with:
   - local run instructions
   - environment notes (Playwright install)
   - known limitations
6. **Add a "dry-run" mode** that returns mock data to test UI without scraping

## Deliverables

- Working codebase
- Clear comments
- Minimal dependencies
- A short "How to use monthly" checklist

## Data Model

### Input Format
```
example.com
google.com
github.com
```

OR

```
example.com, google.com, github.com
```

### Output Format (JSON)
```json
{
  "results": [
    {
      "domain": "example.com",
      "monthlyVisits": 123000,
      "avgSessionDuration": "2m 15s",
      "avgSessionDurationSeconds": 135,
      "bounceRate": null,
      "pagesPerVisit": null,
      "checkedAt": "2024-01-15T10:30:00Z",
      "error": null
    }
  ],
  "metadata": {
    "totalDomains": 3,
    "batchesProcessed": 1,
    "cacheHits": 0,
    "cacheMisses": 3
  }
}
```

### TSV Export Format
```
Domain	MonthlyVisits	AvgSessionDuration	CheckedAt
example.com	123000	2m 15s	2024-01-15T10:30:00Z
google.com	5000000000	5m 30s	2024-01-15T10:30:00Z
```

## Error Handling

- Network errors: Retry once, then mark domain as failed
- Parsing errors: Return null values with error message
- Rate limit errors: Exponential backoff
- Invalid domains: Skip with error message

## Performance Considerations

- Cache results for 30 days (keyed by domain + month)
- Batch processing with delays to respect rate limits
- Progress updates to frontend during batch processing
- Timeout handling for slow responses (30s per batch)

## Testing Strategy

- Unit tests for domain normalization
- Unit tests for number parsing (K, M suffixes)
- Unit tests for duration parsing
- Integration tests for API endpoint (with dry-run mode)
- E2E tests for UI flows (optional)

## Future Enhancements (Out of Scope for MVP)

- Persistent cache (database/file)
- Scheduled batch runs
- Email notifications
- Historical tracking
- API authentication
- Multiple data source support

