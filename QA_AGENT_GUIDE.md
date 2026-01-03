# QA Agent Guide - TrafficLens

Comprehensive guide for the automated QA agent, including common errors, troubleshooting, and handling CSS/HTML changes from traffic.cv.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Running QA Tests](#running-qa-tests)
4. [Common Errors & Solutions](#common-errors--solutions)
5. [CSS Selector Changes from traffic.cv](#css-selector-changes-from-trafficcv)
6. [How to Update Selectors](#how-to-update-selectors)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## Overview

The QA Agent is an automated testing system that:
- Runs daily tests to ensure TrafficLens is working correctly
- Detects common errors and attempts auto-fixes
- Generates detailed reports for debugging
- Alerts when traffic.cv changes their HTML/CSS structure

---

## Setup

### Installation

Dependencies are already installed. If needed:

```bash
npm install
```

### Running QA Tests

**Manual Run:**
```bash
npm run qa
```

**Daily Automated Run (GitHub Actions):**
- Automatically runs daily at 2 AM UTC
- Reports saved as artifacts in GitHub Actions

**Local Cron Setup:**
```bash
chmod +x scripts/setup-cron.sh
./scripts/setup-cron.sh
```

### Viewing Reports

Reports are saved to `qa-reports/qa-report-{timestamp}.json`:

```bash
# View latest report
ls -lt qa-reports/ | head -2
cat qa-reports/qa-report-*.json | jq '.'
```

---

## Common Errors & Solutions

### 1. Browser Launch Errors

**Error:** `browserType.launch: Executable doesn't exist`
**Error:** `browserType.launch: Target page, context or t`

**Causes:**
- Playwright browser not installed
- Railway/Vercel environment issues
- Browser binary missing

**Solutions:**

1. **Local Development:**
   ```bash
   npx playwright install chromium --with-deps
   ```

2. **Railway:**
   - Check `postinstall` script in `package.json`
   - Verify Node.js version (>= 20.9.0)
   - Check Railway logs for installation errors

3. **Vercel:**
   - Playwright doesn't work well on Vercel serverless
   - **Recommendation:** Use Railway instead

**Auto-Fix:** QA agent will detect and suggest retry with increased wait times

---

### 2. Data Extraction Failures

**Error:** `No data found on page (selectors may need update)`
**Error:** `Extracted 0 results from cards (expected 10 domains)`

**Causes:**
- traffic.cv changed their HTML/CSS structure
- Selectors are outdated
- Page loading timeout

**Solutions:**

1. **Check Current Selectors:**
   - Open `lib/scraper.ts`
   - Review selectors in `extractFromTable()` and `extractFromCards()`
   - Compare with traffic.cv's current HTML structure

2. **Update Selectors:**
   - See [How to Update Selectors](#how-to-update-selectors) section
   - Test with: `npm run qa`

3. **Increase Wait Times:**
   - In `lib/scraper.ts`, increase `page.waitForTimeout()` values
   - Increase `verificationTimeout` for Railway

**Auto-Fix:** QA agent will retry with increased wait times, but manual selector update may be needed

---

### 3. Cache Issues

**Error:** `Data not cached in database`
**Error:** `Cached data marked as stale incorrectly`

**Causes:**
- Database connection issues
- Cache expiration logic problems
- Database file permissions (Railway)

**Solutions:**

1. **Check Database Path:**
   - Verify `DATABASE_PATH` environment variable
   - For Railway: Check volume mount path

2. **Database Permissions:**
   ```bash
   # Railway: Ensure volume has write permissions
   chmod 755 /data  # or your volume mount path
   ```

3. **Reset Cache:**
   - Delete `data/traffic.db` (local)
   - Database will be recreated on next run

**Auto-Fix:** QA agent can clear stale cache entries automatically

---

### 4. Order Preservation Issues

**Error:** `Order mismatch at index X: expected Y, got Z`

**Causes:**
- Domain normalization issues
- www. variation matching problems

**Solutions:**

1. **Check Domain Normalization:**
   - Review `lib/domain-utils.ts`
   - Ensure www. variations are handled correctly

2. **Verify API Response:**
   - Check that API returns results in correct order
   - Review `app/api/traffic/route.ts` sorting logic

**Auto-Fix:** Usually requires code fix, but QA agent will identify the issue

---

### 5. Parsing Errors

**Error:** `Invalid duration format: X`
**Error:** `Invalid monthly visits (negative)`

**Causes:**
- traffic.cv changed data format
- Parsing regex patterns outdated

**Solutions:**

1. **Check Parsing Utils:**
   - Review `lib/parsing-utils.ts`
   - Update regex patterns if traffic.cv format changed

2. **Test Parsing:**
   ```typescript
   // In lib/parsing-utils.ts
   parseNumberWithSuffix("82.28B") // Should return 82280000000
   parseDurationToSeconds("00:10:10") // Should return 610
   ```

**Auto-Fix:** Manual fix required - update parsing functions

---

## CSS Selector Changes from traffic.cv

### Current Selectors in Use

The scraper uses multiple selector strategies for robustness. Here are the current selectors:

#### Table View Selectors

**Location:** `lib/scraper.ts` → `extractFromTable()`

```typescript
const rowSelectors = [
  'table tbody tr',        // Primary: Standard table rows
  '.table tbody tr',       // Fallback: Table with class
  'table tr',              // Fallback: Any table row
  '[role="row"]',          // Fallback: ARIA role
  'tr[data-domain]',       // Fallback: Data attribute
  'tbody > tr',            // Fallback: Direct child
];
```

**Column Detection:**
- Looks for headers with text containing: "visit", "duration", "page", "bounce"
- Uses column index based on header position

#### Card View Selectors

**Location:** `lib/scraper.ts` → `extractFromCards()`

```typescript
const cardSelectors = [
  '[class*="card"]',       // Primary: Any element with "card" in class
  'article',               // Fallback: Semantic HTML
  '[class*="result"]',     // Fallback: Any element with "result" in class
  '[data-domain]',         // Fallback: Data attribute
];
```

**Domain Detection:**
```typescript
const domainSelectors = [
  'a[href*="http"]',       // Links
  'h1, h2, h3, h4, h5, h6', // Headings
  '[class*="domain"]',     // Elements with "domain" in class
  '[class*="title"]',      // Elements with "title" in class
  'strong, b',             // Bold text
  '[data-domain]',         // Data attribute
];
```

#### Content Verification

**Location:** `lib/scraper.ts` → `scrapeTrafficData()`

```typescript
// Checks for cards/rows with actual data
const cards = document.querySelectorAll('[class*="card"], table tbody tr, [class*="result"]');
// Verifies cards contain:
// - Domain-like text (contains dot and letters)
// - Metrics (numbers, durations, percentages)
```

---

### How to Update Selectors

When traffic.cv changes their HTML/CSS structure, follow these steps:

#### Step 1: Inspect traffic.cv's New Structure

1. **Open traffic.cv in Browser:**
   ```
   https://traffic.cv/bulk?domains=google.com,github.com
   ```

2. **Open Developer Tools:**
   - Chrome/Edge: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

3. **Inspect the Results:**
   - Right-click on a domain result → "Inspect Element"
   - Note the HTML structure and CSS classes

#### Step 2: Identify New Selectors

**For Table View:**
- Find the `<table>` element
- Check `<tbody>` and `<tr>` structure
- Note any class names or data attributes

**For Card View:**
- Find card containers
- Check for class names containing "card", "result", "domain"
- Note how domains and metrics are structured

#### Step 3: Update Code

**File:** `lib/scraper.ts`

**Update Table Selectors:**
```typescript
// In extractFromTable() function
const rowSelectors = [
  'table tbody tr',           // Keep if still valid
  'YOUR_NEW_SELECTOR',        // Add new selector
  // ... other selectors
];
```

**Update Card Selectors:**
```typescript
// In extractFromCards() function
const cardSelectors = [
  '[class*="card"]',          // Keep if still valid
  'YOUR_NEW_SELECTOR',        // Add new selector
  // ... other selectors
];
```

**Update Domain Selectors:**
```typescript
// In extractFromCards() function
const domainSelectors = [
  'a[href*="http"]',          // Keep if still valid
  'YOUR_NEW_SELECTOR',        // Add new selector
  // ... other selectors
];
```

#### Step 4: Test Changes

1. **Run QA Tests:**
   ```bash
   npm run qa
   ```

2. **Test Manually:**
   ```bash
   npm run dev
   # Open localhost:3000
   # Test with: google.com, github.com
   ```

3. **Check Railway (if deployed):**
   - Push changes to GitHub
   - Monitor Railway logs
   - Test on production URL

#### Step 5: Update Documentation

- Update this guide with new selectors
- Document what changed and why
- Note any breaking changes

---

### Example: Selector Update Scenario

**Scenario:** traffic.cv changes from table view to card view with new classes

**Old Structure:**
```html
<table>
  <tbody>
    <tr>
      <td>google.com</td>
      <td>82.28B</td>
    </tr>
  </tbody>
</table>
```

**New Structure:**
```html
<div class="traffic-card">
  <div class="domain-name">google.com</div>
  <div class="traffic-stats">
    <span>82.28B</span>
  </div>
</div>
```

**Update Required:**

1. **Add new card selector:**
   ```typescript
   const cardSelectors = [
     '.traffic-card',        // NEW: Specific class
     '[class*="card"]',      // Keep for backward compatibility
     // ... other selectors
   ];
   ```

2. **Update domain selector:**
   ```typescript
   const domainSelectors = [
     '.domain-name',         // NEW: Specific class
     'a[href*="http"]',      // Keep for backward compatibility
     // ... other selectors
   ];
   ```

3. **Update metric extraction:**
   ```typescript
   // In extractFromCards(), update regex or selectors
   // to match new structure
   ```

---

## Troubleshooting

### QA Agent Not Running

**Check:**
1. GitHub Actions enabled in repository
2. Cron job configured (if using local cron)
3. Dependencies installed: `npm install`

**Debug:**
```bash
# Test QA agent manually
npm run qa

# Check logs
tail -f logs/qa-agent.log
```

### False Positives

If QA agent reports errors but site works:

1. **Check Test Domains:**
   - Some domains may legitimately have no data
   - Update `QA_TEST_DOMAINS` in `scripts/qa-agent.ts`

2. **Review Error Thresholds:**
   - Some errors may be expected (e.g., invalid domains)
   - Adjust test expectations if needed

### Performance Issues

If QA tests take too long:

1. **Reduce Test Domains:**
   - Edit `QA_TEST_DOMAINS` in `scripts/qa-agent.ts`
   - Use fewer domains for faster tests

2. **Increase Timeouts:**
   - In `lib/scraper.ts`, adjust wait times
   - Balance between speed and reliability

---

## Monitoring & Alerts

### GitHub Actions

- **Workflow:** `.github/workflows/qa-daily.yml`
- **Schedule:** Daily at 2 AM UTC
- **Artifacts:** QA reports saved for 30 days
- **Notifications:** Configure in GitHub repository settings

### Custom Alerts

Add notifications to `scripts/qa-agent.ts`:

```typescript
// Email notification example
if (report.failed > 0) {
  // Send email
  sendEmail({
    to: 'your-email@example.com',
    subject: 'TrafficLens QA Tests Failed',
    body: `Failed tests: ${report.failed}/${report.totalTests}`
  });
}

// Slack notification example
if (report.failed > 0) {
  // Send to Slack
  sendSlackMessage({
    channel: '#trafficlens-alerts',
    text: `⚠️ QA Tests Failed: ${report.failed} tests failed`
  });
}
```

### Log Monitoring

**Local:**
```bash
tail -f logs/qa-agent.log
```

**Railway:**
- Check Railway logs dashboard
- Set up log aggregation if needed

---

## Quick Reference

### Key Files

- **QA Agent:** `scripts/qa-agent.ts`
- **Scraper:** `lib/scraper.ts`
- **Selectors:** `lib/scraper.ts` (extractFromTable, extractFromCards)
- **Parsing:** `lib/parsing-utils.ts`
- **Database:** `lib/db.ts`

### Common Commands

```bash
# Run QA tests
npm run qa

# Run QA with daily script
npm run qa:daily

# Setup cron
./scripts/setup-cron.sh

# View latest report
ls -lt qa-reports/ | head -2

# Test scraper manually
npm run dev
# Then test at localhost:3000
```

### Emergency Fixes

**If traffic.cv changes break scraping:**

1. **Immediate:** Check traffic.cv HTML structure
2. **Update:** Selectors in `lib/scraper.ts`
3. **Test:** `npm run qa`
4. **Deploy:** Push to GitHub/Railway

**If database issues:**

1. **Check:** Database path and permissions
2. **Reset:** Delete `data/traffic.db` (will recreate)
3. **Verify:** Database connection in logs

---

## Support

For issues or questions:
1. Check this guide first
2. Review QA reports in `qa-reports/`
3. Check Railway/GitHub Actions logs
4. Review `lib/scraper.ts` selectors against traffic.cv

---

**Last Updated:** 2025-12-30
**Maintainer:** TrafficLens Team

