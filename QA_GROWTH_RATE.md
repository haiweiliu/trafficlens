# Growth Rate Extraction - QA Review

## Problem
- `mudwtr.com` shows **+249.64%** instead of **+19.66%** (from traffic.cv)
- Other domains also showing incorrect growth rates

## Root Cause
Growth rate extraction from traffic.cv UI was failing, causing fallback to calculation from historical data, which produced incorrect results.

## Solution Implemented

### 1. Simplified Extraction Logic
- **Removed**: Complex DOM traversal with TreeWalker
- **Added**: Direct HTML/text regex pattern matching
- **Pattern**: Searches for `+XX.XX%` or `-XX.XX%` near "Total Visits" in HTML context

### 2. Extraction Methods (in order of priority)
1. **HTML Context Search**: Searches 500 chars around "Total Visits" in card HTML
2. **Text Context Search**: Searches 300 chars in plain text (fallback)
3. **Calculation**: Only if extraction fails (with warning)

### 3. Validation
- Excludes percentages near "bounce", "duration", "pages", "avg"
- Requires `+` or `-` sign (excludes bounce rate which has no sign)
- Validates range: -1000% to +1000%

### 4. Logging & Debugging
- `✓ Extracted growth rate from HTML: X%` - Success
- `✓ Extracted growth rate from text: X%` - Fallback success
- `⚠ Growth rate extraction failed` - Extraction failed
- `⚠ Calculated growth from historical: X%` - Using calculation (less accurate)
- `⚠ WARNING: This is calculated, not extracted from traffic.cv UI - may be inaccurate!`

## Testing Checklist

### Test Case 1: mudwtr.com
- **Expected**: +19.66%
- **Test**: Run with "Bypass Cache" checked
- **Check logs**: Should see `✓ Extracted growth rate from HTML: 19.66%`

### Test Case 2: daily-harvest.com
- **Expected**: -16.62% (from traffic.cv screenshot)
- **Test**: Run with "Bypass Cache" checked
- **Check logs**: Should see extraction success message

### Test Case 3: organifishop.com
- **Expected**: +29.26% (from traffic.cv screenshot)
- **Test**: Run with "Bypass Cache" checked
- **Check logs**: Should see extraction success message

### Test Case 4: Multiple domains
- **Test**: Run all 4 domains together
- **Verify**: All show correct growth rates matching traffic.cv

## How to Verify

1. **Check Server Logs** (Railway/localhost):
   - Look for `[domain] ✓ Extracted growth rate from HTML: X%`
   - If you see `⚠ Calculated growth`, extraction failed

2. **Compare with traffic.cv**:
   - Visit: https://traffic.cv/bulk?domains=mudwtr.com,daily-harvest.com,apothekary.co,organifishop.com
   - Compare growth rates shown in green/red badges next to "Total Visits"

3. **Expected Results**:
   - mudwtr.com: **+19.66%** (green)
   - daily-harvest.com: **-16.62%** (red)
   - organifishop.com: **+29.26%** (green)
   - apothekary.co: Check traffic.cv for expected value

## Debugging

If extraction still fails:
1. Check server logs for `⚠ Growth rate extraction failed`
2. Look for `Card text preview:` to see what text was extracted
3. Verify the HTML structure matches expected pattern
4. Check if "Total Visits" text is found correctly

## Files Changed
- `lib/scraper.ts`: Simplified extraction logic
- `app/api/traffic/route.ts`: Added warnings for calculated values

