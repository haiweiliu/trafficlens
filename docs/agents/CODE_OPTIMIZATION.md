# Code Optimization Agent

## Overview

The Code Optimization Agent analyzes the codebase for performance issues, bundle size problems, memory leaks, and API optimization opportunities.

## What It Checks

### 1. API Routes
- Missing `maxDuration` configuration
- Blocking operations (sleep, setTimeout, loops)
- Multiple array operations (potential N+1 issues)
- Large data processing

### 2. Components
- Large component files (>10KB)
- Missing React.memo optimization
- Inline functions in JSX

### 3. Database
- N+1 query patterns
- Missing indexes
- Inefficient queries

### 4. Scraper
- Sequential awaits (should use Promise.all)
- Memory leaks (missing browser.close)
- Long-running operations

## Running the Agent

```bash
npm run code:optimize
```

## Output

The agent generates a report with:
- Total issues found
- Issues grouped by type
- Issues grouped by severity
- Detailed suggestions for each issue

## Email Notifications

Sends email to `mingcomco@gmail.com` when:
- High-severity issues are found
- Critical performance problems detected

## Example Issues

### High Severity
- Memory leaks (browser instances not closed)
- N+1 query patterns
- Long-running operations in API routes

### Medium Severity
- Missing maxDuration in API routes
- Large component files
- Multiple array operations

### Low Severity
- Missing React.memo
- Inline functions in JSX
- Missing compression config

## Fixing Issues

The agent provides specific suggestions for each issue. Common fixes include:

1. **Add maxDuration** to API routes:
   ```typescript
   export const maxDuration = 300;
   ```

2. **Use Promise.all** for parallel operations:
   ```typescript
   const results = await Promise.all(promises);
   ```

3. **Add React.memo** to components:
   ```typescript
   export default React.memo(MyComponent);
   ```

4. **Add database indexes**:
   ```sql
   CREATE INDEX idx_domain ON traffic_latest(domain);
   ```

## Integration

The agent can be integrated into:
- GitHub Actions (weekly runs)
- CI/CD pipeline
- Pre-commit hooks

