# Quick Usage Guide

## First Time Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browser:
   ```bash
   npx playwright install chromium
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Monthly Workflow

### Step 1: Prepare Your Domain List
- Copy domains from your spreadsheet or database
- Format: one per line or comma-separated
- Example:
  ```
  example.com
  google.com
  github.com
  ```

### Step 2: Run the Tool
1. Paste domains into the textarea
2. Click **"Normalize"** to clean up (optional but recommended)
3. Uncheck **"Dry Run"** for real data (or leave checked to test)
4. Click **"Run"**
5. Wait for all batches to complete (watch progress indicator)

### Step 3: Export Results
1. Review results in the table
2. Click **"Copy TSV"** to copy for Google Sheets
3. Or click **"Download CSV"** to save a file

### Step 4: Paste into Google Sheets
1. Open your tracking spreadsheet
2. Select the cell where you want to paste
3. Paste (Cmd+V / Ctrl+V)
4. Data will automatically populate columns

## Tips

- **Use Dry Run first**: Test the UI with mock data before running real checks
- **Check for errors**: Review the Status column for any failed domains
- **Cache helps**: Re-running the same domains within 30 days uses cache (faster, no API calls)
- **Large lists**: The tool automatically batches domains (10 per batch, 4 second delays)
- **Save exports**: Download CSV files for historical tracking

## Troubleshooting

**No data returned?**
- Try dry-run mode first to test UI
- Check domain format (should be just domain.com, no http://)
- Verify Traffic.cv is accessible

**Playwright errors?**
- Run: `npx playwright install chromium`
- Check Node.js version (need 18+)

**Type errors?**
- Run: `npm install`
- Check TypeScript version

## Example Output

**TSV (for Google Sheets):**
```
Domain	MonthlyVisits	AvgSessionDuration	CheckedAt
example.com	123000	2m 15s	2024-01-15T10:30:00Z
google.com	5000000000	5m 30s	2024-01-15T10:30:00Z
```

**CSV (full data):**
```
Domain,MonthlyVisits,AvgSessionDuration,BounceRate,PagesPerVisit,CheckedAt
example.com,123000,2m 15s,45.2,3.5,2024-01-15T10:30:00Z
google.com,5000000000,5m 30s,35.8,4.2,2024-01-15T10:30:00Z
```

