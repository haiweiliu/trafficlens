# Auto-Fix Workflow System

## Overview

The Auto-Fix Agent automatically detects selector errors and attempts to fix them by testing alternative selectors. This creates a systematic approach to fixing errors without manual intervention.

## How It Works

### 1. Error Detection
- QA Agent runs tests and detects errors
- Identifies selector-related errors (e.g., "No data found on page (selectors")

### 2. Auto-Fix Attempt
When selector errors are detected:
1. **Test Selectors**: Tests multiple selector strategies for the failed domain
2. **Find Working Selectors**: Identifies which selectors successfully find data
3. **Generate Suggestions**: Creates fix suggestions with code snippets
4. **Save Reports**: Saves fix suggestions to `auto-fixes/` directory

### 3. Fix Application
- Fix suggestions are saved as Markdown files
- Includes code snippets with working selectors
- Provides step-by-step instructions

### 4. Notification
- Sends email notification with error details
- Includes fix suggestions in the report

## Workflow Steps

```
1. QA Agent runs tests
   ↓
2. Detects selector errors
   ↓
3. Auto-Fix Agent triggered
   ↓
4. Tests alternative selectors
   ↓
5. Finds working selectors
   ↓
6. Generates fix suggestions
   ↓
7. Saves to auto-fixes/ directory
   ↓
8. Sends email notification
```

## Running Auto-Fix Manually

```bash
# Run auto-fix agent directly
npm run auto-fix

# Or run QA agent (triggers auto-fix if errors found)
npm run qa
```

## Fix Suggestions Location

Fix suggestions are saved to:
- `auto-fixes/fix-{domain}-{timestamp}.md` - Individual domain fixes
- `auto-fixes/summary-{timestamp}.json` - Summary report

## Example Fix Suggestion

When a selector error is detected, the system generates a file like:

```markdown
# Selector Fix Suggestions

**Error:** No data found on page (selectors may need update)

## Working Selectors Found

- `[class*="card"]`
- `article`
- `[class*="result"]`

## Recommended Fix

Update `lib/scraper.ts` to add these selectors to the selector arrays:

```typescript
const cardSelectors = [
  '[class*="card"]',
  'article',
  '[class*="result"]',
  // ... existing selectors
];
```

## Integration with QA Agent

The QA Agent automatically triggers the Auto-Fix Agent when selector errors are detected:

1. QA Agent runs tests
2. If selector errors found → Auto-Fix Agent runs
3. Fix suggestions generated
4. Email notification sent
5. Developer reviews fix suggestions and applies them

## Next Steps (Future Enhancement)

For fully automatic fixing (not implemented yet for safety):

1. **Automatic Code Updates**: 
   - Parse fix suggestions
   - Update `lib/scraper.ts` automatically
   - Run tests to verify fix works
   - Commit changes (optional)

2. **Selector Learning**:
   - Track which selectors work over time
   - Build a database of working selectors
   - Automatically use best-performing selectors

3. **A/B Testing**:
   - Test multiple selector strategies
   - Use the one with highest success rate
   - Fallback to alternatives if primary fails

## Safety Considerations

**Current Implementation:**
- ✅ Detects errors automatically
- ✅ Tests alternative selectors
- ✅ Generates fix suggestions
- ✅ Saves reports (no code modification)
- ✅ Requires manual review before applying

**Future (if implemented):**
- ⚠️ Automatic code updates (risky - needs careful testing)
- ⚠️ Automatic commits (very risky - should require approval)

## Manual Fix Process

1. Check `auto-fixes/` directory for fix suggestions
2. Review the suggested code changes
3. Update `lib/scraper.ts` with working selectors
4. Test the fix: `npm run qa`
5. If successful, commit changes

## Monitoring

- Fix suggestions are logged to console
- Email notifications sent on errors
- Summary reports saved as JSON
- All fixes tracked with timestamps

