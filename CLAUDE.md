# TrafficLens Development Guide

This file is maintained by the team and Claude. Anytime we see Claude do something incorrectly, we add it here so Claude knows not to do it next time.

## Core Principles

**Always verify your work.** Use feedback loops - test, validate, iterate. This 2-3x improves code quality.

**Think systematically.** Build systems that compound over time, not one-off fixes.

**Cache aggressively.** SimilarWeb data updates monthly - cache for 30 days. Zero traffic results are valid and should be cached.

**Handle "No valid data" immediately.** Don't scrape domains that show "No valid data" - return 0 traffic instantly.

---

## Development Workflow

### 1. Make Changes
- Use TypeScript strictly
- Follow existing code patterns
- Keep functions focused and testable

### 2. Typecheck
```bash
npm run build
```

### 3. Test Locally
```bash
npm run dev
# Test in browser at localhost:3000
```

### 4. Before Committing
- Run typecheck
- Test critical paths manually
- Verify cache works correctly

---

## Common Mistakes to Avoid

### ❌ NEVER Do These

1. **Don't use `www.` in domain queries**
   - ✅ Correct: `example.com`
   - ❌ Wrong: `www.example.com` (when querying traffic.cv)
   - Always normalize domains before querying

2. **Don't treat 0 traffic as an error**
   - ✅ Correct: `monthlyVisits: 0, error: null`
   - ❌ Wrong: `monthlyVisits: null, error: 'No data found'`
   - 0 traffic is valid data, not an error

3. **Don't scrape "No valid data" domains**
   - ✅ Correct: Detect "No valid data" message → return 0 traffic immediately
   - ❌ Wrong: Start background scraping for domains with no data
   - Check page content first, return early if "No valid data" detected

4. **Don't forget to store 0 traffic results**
   - ✅ Correct: Store all results (including 0 traffic) in database
   - ❌ Wrong: Only store non-zero results
   - 0 traffic results should be cached to avoid re-scraping

5. **Don't use blocking operations in API routes**
   - ✅ Correct: Return cached results immediately, scrape in background
   - ❌ Wrong: Wait for scraping to complete before returning
   - Always return cached data instantly

6. **Don't ignore domain normalization**
   - ✅ Correct: Normalize domains (remove www., protocols, paths) before matching
   - ❌ Wrong: Direct string matching without normalization
   - Always use `normalizeDomain()` utility

7. **Don't hardcode selectors**
   - ✅ Correct: Use multiple selector strategies, test alternatives
   - ❌ Wrong: Rely on single selector
   - Always have fallback selectors

8. **Don't skip error handling**
   - ✅ Correct: Distinguish between 0 traffic and actual errors
   - ❌ Wrong: Treat all failures the same
   - Provide specific error messages

9. **Don't forget to format duration**
   - ✅ Correct: Convert `avgSessionDurationSeconds` to `HH:MM:SS` format
   - ❌ Wrong: Return raw seconds or null
   - Always format for display

10. **Don't create placeholders without checking cache first**
    - ✅ Correct: Check database cache → quick scrape → background scrape
    - ❌ Wrong: Create placeholders immediately
    - Always try cache and quick scrape first

---

## Best Practices

### Domain Handling
- **Always normalize** before querying traffic.cv
- **Remove www.** for matching (but preserve original for display)
- **Handle both www. and non-www.** variations in cache lookups
- **Use domainMap** for flexible matching in scrapers

### Caching Strategy
- **Cache for 30 days** (SimilarWeb updates monthly)
- **Accept 0 traffic as valid cached data**
- **Check cache first** - return instantly if found
- **Store immediately** after scraping (including 0 traffic)

### Error Handling
- **Distinguish 0 traffic from errors**
  - 0 traffic: `monthlyVisits: 0, error: null`
  - Error: `monthlyVisits: null, error: 'message'`
- **Provide specific error messages**
- **Retry failed domains** in background
- **Don't show errors for 0 traffic** (show green checkmark)

### Performance
- **Return cached results instantly** (<100ms)
- **Quick scrape for "No valid data"** (<1s)
- **Background scrape** for actual cache misses
- **Timeout after 1 minute** (not 2 minutes)
- **Block unnecessary resources** (images, fonts, stylesheets)

### Data Extraction
- **Test multiple selectors** (cards, tables, generic)
- **Wait for content verification** before extracting
- **Handle billion units** (B suffix)
- **Parse durations** correctly (HH:MM:SS format)
- **Validate data** before storing

### Code Quality
- **Use TypeScript strictly** - no `any` types
- **Keep functions focused** - single responsibility
- **Add error handling** - never assume success
- **Log important events** - for debugging
- **Test edge cases** - www. variations, 0 traffic, errors

---

## Traffic.cv Specifics

### URL Format
- ✅ Correct: `https://traffic.cv/bulk?domains=example.com,test.com`
- ❌ Wrong: `https://traffic.cv/bulk?domains=www.example.com`
- Always remove www. and protocols from query domains

### "No Valid Data" Detection
- Check immediately after page load (500ms wait)
- Look for: "no valid data", "unregistered domain", "not registered", "data is unavailable"
- Return 0 traffic immediately, don't scrape further

### Selector Strategy
- Try table format first (most common)
- Fallback to card format
- Generic extraction as last resort
- Always verify content before extracting

### Wait Times
- Localhost: 3s base wait
- Railway: 6s base wait (slower environment)
- Quick check: 500ms for "No valid data"
- Verification: 5-15s depending on environment

---

## Database Patterns

### Storing Data
- Always store `monthlyVisits` (including 0)
- Store `avgSessionDurationSeconds` (convert to formatted string on retrieval)
- Store `checkedAt` timestamp
- Store `month_year` for monthly snapshots

### Cache Lookup
- Check both www. and non-www. variations
- Use `isDataFresh()` to validate cache age
- Accept 0 traffic results as valid cached data
- Handle domain normalization in lookups

---

## API Route Patterns

### Response Flow
1. Check cache → return instantly if found
2. Quick scrape for cache misses → return immediately if successful
3. Background scrape → only for actual errors
4. Poll for updates → max 1 minute

### Error Handling
- Return cached results even if some domains fail
- Show placeholders only for domains needing background scrape
- Update results in real-time via polling
- Timeout gracefully after 1 minute

---

## Testing Checklist

Before deploying, verify:
- [ ] Cached domains return instantly
- [ ] "No valid data" domains return 0 traffic immediately
- [ ] www. variations handled correctly
- [ ] 0 traffic results are cached
- [ ] Background scraping works for actual errors
- [ ] Timeout works (1 minute max)
- [ ] Data formats are correct (HH:MM:SS, percentages, etc.)

---

## Common Fixes

### Selector Not Found
- Add more selector variations
- Increase wait times
- Verify content before extracting
- Check if page structure changed

### Domain Not Found
- Verify domain normalization
- Check www. variations
- Verify domain appears on page
- May be 0 traffic (not an error)

### Cache Not Working
- Verify database connection
- Check `isDataFresh()` logic
- Verify domain normalization in cache lookup
- Check if 0 traffic results are being cached

### Performance Issues
- Block unnecessary resources
- Return cached results immediately
- Use background scraping
- Optimize wait times

---

## When Adding New Features

1. **Plan first** - Use Plan mode, think through approach
2. **Verify work** - Add tests/validation
3. **Update this file** - Document learnings
4. **Test edge cases** - www. variations, 0 traffic, errors
5. **Check cache** - Ensure caching works correctly

---

## Agent Integration

When creating agents:
- Use verification feedback loops
- Test before deploying
- Learn from errors
- Update documentation
- Compound improvements

---

## Critical: Instant Cache Returns

### The Problem We Fixed (January 2026)
"Loading cached results..." was taking too long because the API was **blocking on scraping** before returning cached data.

### The Rule: NEVER Block on Scraping
```
✅ CORRECT:
1. Check cache → return cached results IMMEDIATELY (<100ms)
2. For cache misses → return placeholders immediately
3. Scrape in background (fire-and-forget)
4. Frontend polls for updates

❌ WRONG:
1. Check cache
2. For cache misses → scrape synchronously (BLOCKS!)
3. Then return all results
```

### Code Pattern
```typescript
// API Route - app/api/traffic/route.ts

// 1. Check cache FIRST
const cached = getLatestTrafficDataBatch(domains);

// 2. Return cached results IMMEDIATELY
const cachedResults = [...cached.values()];

// 3. Create placeholders for cache misses (no blocking)
const placeholders = cacheMisses.map(domain => ({
  domain,
  monthlyVisits: null,
  error: 'Scraping in background...',
}));

// 4. Return immediately (no await!)
scrapeInBackground(cacheMisses).catch(console.error);  // Fire-and-forget

return Response.json({ results: [...cachedResults, ...placeholders] });
```

### Frontend Feedback
```
All cached:    "✅ All 80 domains served from cache (instant)"
Mixed:         "📦 50 from cache (instant). ⏳ Scraping 30 new domains..."
Completed:     "✅ Done! 50 from cache, 30 freshly scraped."
```

### Why This Matters
- SimilarWeb data updates monthly
- Once checked, data is valid for 30 days
- Previously checked domains should return in <100ms
- Users shouldn't wait for new domains when cached data exists

---

## Remember

- **Cache is king** - SimilarWeb updates monthly, cache aggressively
- **0 traffic is valid** - Not an error, should be cached
- **Return fast** - Cached results instantly, quick scrape for "No valid data"
- **NEVER block on scraping** - Return cached data immediately, scrape in background
- **Verify everything** - Test, validate, iterate
- **Document learnings** - Update this file when you learn something new

---

*This file is a living document. Update it whenever you learn something new or see Claude make a mistake.*

