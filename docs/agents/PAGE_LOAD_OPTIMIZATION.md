# Page Load Optimization Agent

## Overview

The Page Load Optimization Agent analyzes Next.js pages, API routes, and configuration for performance optimization opportunities.

## What It Checks

### 1. Pages
- Large client components (>5KB)
- Missing Suspense boundaries
- Many static imports (>5)
- Using `<img>` instead of `next/image`
- Using CSS `font-family` instead of `next/font`

### 2. API Routes
- Missing cache headers
- Long-running operations without background processing

### 3. Next.js Config
- Missing compression configuration
- Missing image optimization config

## Running the Agent

```bash
npm run page:optimize
```

## Output

The agent generates a report with:
- Total issues found
- Issues grouped by type (image, font, script, css, api, bundle, hydration)
- Issues grouped by severity
- Detailed suggestions for each issue

## Email Notifications

Sends email to `mingcomco@gmail.com` when:
- High-severity issues are found
- Critical performance problems detected

## Example Issues

### High Severity
- Using `<img>` instead of `next/image`
- Long-running operations in API routes

### Medium Severity
- Large client components
- Missing cache headers
- Many static imports

### Low Severity
- Missing Suspense boundaries
- Using CSS fonts instead of `next/font`
- Missing compression config

## Fixing Issues

The agent provides specific suggestions for each issue. Common fixes include:

1. **Use next/image**:
   ```tsx
   import Image from 'next/image';
   <Image src="/image.jpg" width={500} height={300} alt="..." />
   ```

2. **Add Suspense boundaries**:
   ```tsx
   <Suspense fallback={<Loading />}>
     <MyComponent />
   </Suspense>
   ```

3. **Use dynamic imports**:
   ```tsx
   const HeavyComponent = dynamic(() => import('./HeavyComponent'));
   ```

4. **Add cache headers**:
   ```typescript
   return NextResponse.json(data, {
     headers: {
       'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
     },
   });
   ```

5. **Use next/font**:
   ```tsx
   import { Inter } from 'next/font/google';
   const inter = Inter({ subsets: ['latin'] });
   ```

## Integration

The agent can be integrated into:
- GitHub Actions (weekly runs)
- CI/CD pipeline
- Pre-commit hooks

