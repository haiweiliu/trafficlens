# 🔍 Troubleshooting: Vercel Playwright Issues

## Current Error
`browserType.launch: Target page, context`

This suggests the browser is trying to launch but failing. Let's debug:

## Check Vercel Logs

1. Go to Vercel Dashboard
2. Click on your project → **Deployments**
3. Click on the latest deployment
4. Click **"Logs"** tab
5. Look for error messages

## Common Issues & Fixes

### Issue 1: @sparticuz/chromium not loading
**Symptom**: Error about chromium executable
**Fix**: Already implemented - dynamic import with fallback

### Issue 2: Memory limits
**Symptom**: Function timeout or crash
**Fix**: 
- Reduce `PARALLEL_BATCHES` from 3 to 1
- In `app/api/traffic/route.ts`, change line 39:
  ```typescript
  const PARALLEL_BATCHES = 1; // Sequential processing
  ```

### Issue 3: Timeout too short
**Symptom**: Function times out
**Fix**: Already set to 300 seconds (5 min) in `vercel.json`

### Issue 4: Browser args incompatible
**Symptom**: Browser launches but crashes
**Fix**: Current code uses minimal args for @sparticuz/chromium

## Quick Test

1. **Test with Dry Run** (should always work):
   - Check "Dry Run (Mock Data)"
   - This bypasses Playwright entirely

2. **Check Vercel Environment**:
   - Go to Project Settings → Environment Variables
   - Verify `VERCEL=1` is set (auto-set by Vercel)

## If Still Failing

**Best Solution**: Deploy to Railway
- See `RAILWAY_DEPLOY.md`
- Works immediately
- No Playwright compatibility issues
- Cheaper ($7-15/month)

## Debug Steps

1. Check Vercel function logs
2. Try with 1 domain only
3. Check if Dry Run works
4. Verify @sparticuz/chromium version matches Playwright

