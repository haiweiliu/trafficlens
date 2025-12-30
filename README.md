# Traffic Bulk Extractor

A Next.js web tool that estimates website traffic by scraping Traffic.cv's Bulk Traffic Checker UI. Perfect for bulk domain analysis with support for exporting data to Google Sheets.

## Features

- ✅ Bulk domain traffic checking (up to 10 domains per batch, automatic batching)
- ✅ Domain normalization (dedupe, strip protocols, remove paths)
- ✅ In-memory caching (30-day TTL) to avoid repeated requests
- ✅ Rate limiting to respect Traffic.cv's limits
- ✅ Sortable results table
- ✅ One-click TSV copy (for Google Sheets)
- ✅ CSV download
- ✅ Dry-run mode for testing UI without scraping
- ✅ Progress indicators for batch processing

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Playwright** (for headless browser scraping)

## Prerequisites

- Node.js 18+ and npm
- Playwright browsers (installed automatically on first run)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd TrafficLens
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

   This will download the Chromium browser needed for scraping.

## Running Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

3. **Test with dry-run mode:**
   - Check the "Dry Run (Mock Data)" checkbox
   - Paste some domains and click "Run"
   - This will return mock data without actually scraping Traffic.cv

## Usage

### Basic Workflow

1. **Paste domains** into the textarea (one per line or comma-separated):
   ```
   example.com
   google.com
   github.com
   ```

2. **Optional: Click "Normalize"** to clean up domains (removes protocols, paths, deduplicates)

3. **Click "Run"** to start checking traffic

4. **View results** in the sortable table

5. **Export data:**
   - **Copy TSV**: Copies tab-separated values ready to paste into Google Sheets
   - **Download CSV**: Downloads a CSV file with all data

### Input Formats Supported

- One domain per line:
  ```
  example.com
  google.com
  ```

- Comma-separated:
  ```
  example.com, google.com, github.com
  ```

- Mixed formats (will be normalized)

- With protocols/paths (will be cleaned):
  ```
  https://example.com/path
  http://google.com?query=1
  ```

### Output Format

**TSV (for Google Sheets):**
```
Domain	MonthlyVisits	AvgSessionDuration	CheckedAt
example.com	123000	2m 15s	2024-01-15T10:30:00Z
```

**CSV (includes all fields):**
```
Domain,MonthlyVisits,AvgSessionDuration,BounceRate,PagesPerVisit,CheckedAt
example.com,123000,2m 15s,45.2,3.5,2024-01-15T10:30:00Z
```

## How to Use Monthly

### Monthly Bulk Check Checklist

1. **Prepare your domain list:**
   - Export domains from your spreadsheet or database
   - Copy the list (one per line or comma-separated)

2. **Run the tool:**
   - Paste domains into the tool
   - Click "Normalize" to clean up
   - Click "Run" (uncheck "Dry Run" for real data)
   - Wait for all batches to complete

3. **Export results:**
   - Click "Copy TSV" to copy for Google Sheets
   - Or click "Download CSV" to save a file

4. **Paste into Google Sheets:**
   - Open your tracking spreadsheet
   - Paste the TSV data (Cmd+V / Ctrl+V)
   - Data will automatically populate columns

5. **Review and analyze:**
   - Check for any errors (marked in Status column)
   - Sort by Monthly Visits to see top performers
   - Compare with previous month's data

### Tips for Monthly Runs

- **Use caching:** Results are cached for 30 days, so re-running the same domains within a month won't hit Traffic.cv again
- **Batch large lists:** The tool automatically splits >10 domains into batches with delays
- **Check errors:** Review domains with errors and re-run them if needed
- **Save exports:** Download CSV files for historical tracking

## Project Structure

```
TrafficLens/
├── app/
│   ├── api/
│   │   └── traffic/
│   │       └── route.ts          # API endpoint for traffic checking
│   ├── globals.css               # Tailwind styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main UI page
├── components/
│   ├── TrafficTable.tsx          # Results table component
│   └── ExportButtons.tsx         # TSV/CSV export buttons
├── lib/
│   ├── cache.ts                  # In-memory cache implementation
│   ├── domain-utils.ts           # Domain normalization utilities
│   ├── parsing-utils.ts          # Number/duration parsing utilities
│   └── scraper.ts                # Playwright scraping logic
├── types/
│   └── index.ts                  # TypeScript type definitions
└── README.md                     # This file
```

## API Endpoint

### POST `/api/traffic`

**Request:**
```json
{
  "domains": ["example.com", "google.com"],
  "dryRun": false
}
```

**Response:**
```json
{
  "results": [
    {
      "domain": "example.com",
      "monthlyVisits": 123000,
      "avgSessionDuration": "2m 15s",
      "avgSessionDurationSeconds": 135,
      "bounceRate": 45.2,
      "pagesPerVisit": 3.5,
      "checkedAt": "2024-01-15T10:30:00Z",
      "error": null
    }
  ],
  "metadata": {
    "totalDomains": 2,
    "batchesProcessed": 1,
    "cacheHits": 0,
    "cacheMisses": 2,
    "errors": []
  }
}
```

## Configuration

### Rate Limiting

Default delay between batches: **4 seconds**

To change, edit `BATCH_DELAY_MS` in `app/api/traffic/route.ts`:
```typescript
const BATCH_DELAY_MS = 4000; // Adjust as needed
```

### Cache TTL

Default cache duration: **30 days**

To change, edit `TTL_DAYS` in `lib/cache.ts`:
```typescript
private readonly TTL_DAYS = 30; // Adjust as needed
```

### Batch Size

Maximum domains per batch: **10** (Traffic.cv limit)

This is enforced in the API route and cannot be changed without violating Traffic.cv's terms.

## Known Limitations

1. **Traffic.cv dependency:** The tool depends on Traffic.cv's bulk checker. If their UI changes, the scraper may need updates.

2. **JavaScript rendering:** Traffic.cv uses client-side rendering, so Playwright is required (not a simple HTTP fetch).

3. **Rate limits:** The tool respects Traffic.cv's limits (10 domains per batch, delays between batches). Running too many domains may take time.

4. **In-memory cache:** Cache is lost on server restart. For production, consider using Redis or a database.

5. **Error handling:** If a domain fails to scrape, it will show an error in the results. You may need to re-run failed domains.

6. **Selector updates:** If Traffic.cv changes their HTML structure, the DOM selectors in `lib/scraper.ts` may need adjustment.

## Troubleshooting

### Playwright browser not found

```bash
npx playwright install chromium
```

### Scraping returns no data

- Check if Traffic.cv's UI has changed
- Verify the domain format is correct
- Try with dry-run mode first to test the UI
- Check browser console for errors

### Rate limiting issues

- Increase `BATCH_DELAY_MS` if you're getting blocked
- Reduce the number of domains per run
- Wait longer between runs

### TypeScript errors

```bash
npm install
```

## Development

### Build for production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Safety & Compliance

⚠️ **Important:** This tool fetches publicly visible estimates from Traffic.cv. Please:
- Respect their Terms of Service
- Don't abuse their service with excessive requests
- Use rate limiting appropriately
- Consider their free tier limits

## License

ISC

## Support

For issues or questions:
1. Check the "Known Limitations" section
2. Review the code comments
3. Test with dry-run mode first
4. Check browser console for errors

---

**Built with ❤️ for efficient bulk domain traffic analysis**

