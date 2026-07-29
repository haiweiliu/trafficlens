---
name: Troubleshooting & Problem Solving
description: Guide to diagnosing and resolving common TrafficLens issues
---

# TrafficLens Troubleshooting Guide

This skill provides a systematic approach to diagnosing and resolving common issues in the TrafficLens application, particularly related to scraping, proxies, and QA failures.

## 🔍 Common Issues & Solutions

### 1. QA Failure: "Timeout 15000ms exceeded"
**Symptoms:**
- QA Agent reports `page.goto: Timeout 15000ms exceeded`.
- "Real Domain Traffic" test fails with 0% success.

**Causes:**
- Proxy latency is high (common with residential proxies).
- Target site (`traffic.cv`) is slow or blocking requests.
- Timeout settings in `lib/scraper.ts` are too aggressive.

**Resolution:**
1.  **Check Proxy Health:** Run `npx tsx scripts/proxy_health_check.ts`.
2.  **Increase Timeouts:** Ensure `page.goto` and `page.setDefaultTimeout` in `lib/scraper.ts` are at least 30s/45s.
3.  **Retry Logic:** Use `retryScrapeTrafficData` which implements exponential backoff.

### 2. QA Failure: "Order Preservation mismatch"
**Symptoms:**
- QA Agent reports `Order mismatch at index X: expected A, got B`.

**Causes:**
- `traffic.cv` returns results in the order they appear on the page, not the order requested.
- Asynchronous processing of concurrent requests (if applicable).

**Resolution:**
- **Ensure Reordering:** The `scrapeTrafficData` function must call `reorderResults` before returning.
- **Reference Implementation:**
```typescript
// lib/scraper.ts
return reorderResults(cardResults, domains);
```

### 3. QA Failure: "Selector Error"
**Symptoms:**
- Scraper returns "No data found on page".
- Auto-Fix Agent triggers.

**Causes:**
- Target site changed its HTML structure (class names, layout).

**Resolution:**
- **Run Auto-Fix manually:** `npm run qa:auto-fix`
- **Inspect DOM:** Open the site in a browser and check if classes like `.card`, `.result`, or `h3` have changed.
- **Update Selectors:** Update `lib/scraper.ts` and `lib/selector-fixer.ts` with new selectors.

### 4. Monthly Visits show N/A (duration only)
**Symptoms:**
- UI shows `N/A` for Monthly Visits but may show duration.
- API returns `monthlyVisits: null` after background scrape completes.

**Cause:**
- Playwright DOM selectors drifted or Cloudflare blocked datacenter IPs.
- Partial results were cached (duration without visits).

**Resolution:**
1. Deploy flight-chunk fetch path (`lib/trafficcv-fetch.ts`) — primary since 2026-07.
2. Purge bad cache: `POST /api/heal` with `x-trafficlens-admin-key`.
3. Run `npm run health:probe` to verify canaries return visits > 0.

### 5. Railway "This page couldn't load" (white triangle)
**Symptoms:**
- Browser shows Railway white triangle — **"This page couldn't load"**.
- `curl /api/health` or `/api/traffic` may still return JSON intermittently.
- **Not** a Next.js client crash or ChunkLoadError.

**Causes:**
- Node process **OOM-killed** by concurrent Playwright (`PARALLEL_BATCHES` > 1 on single-container Railway).
- Redeploy gap — no `healthcheckPath`; traffic routed before process ready.
- Cursor embedded browser cached a failed navigation.

**Resolution:**
1. Confirm liveness: `curl -sf https://trafficlens.up.railway.app/api/health`.
2. Set **`TL_PARALLEL_BATCHES=1`** on Railway (mandatory for single-container).
3. Verify `railway.json` has `healthcheckPath: /api/health` and `next start -H 0.0.0.0`.
4. Hard refresh browser (Cmd+Shift+R) before declaring UI regression.
5. Check Railway deploy logs for OOM / SIGKILL — not application stack traces.

### 6. Liveness vs data-quality probes
| Probe | Endpoint | Purpose |
|-------|----------|---------|
| **Liveness** | `GET /api/health` | Railway routing; no Playwright |
| **Functional canary** | `npm run health:probe` | Asserts canary domains have `monthlyVisits > 0` |
| **Heal** | `POST /api/heal` | Purges incomplete cache + re-fetch |

Never substitute `/api/health` for scrape-quality verification.

## 🛠️ Diagnostic Tools

### Local QA Run
Run the full QA suite locally to reproduce issues:
```bash
npx tsx scripts/qa-agent.ts
```

### Proxy Health Check
Verify if proxies are working and check their latency:
```bash
npx tsx scripts/proxy_health_check.ts
```

### Debug Scraper
Run a minimal scraper script to test a specific domain:
```bash
npx tsx scripts/probe_scrape.ts threads.com github.com
```

### Health Cron (Never-Down)
Daily probe at **06:00 local**; self-heal + free-llm diagnose **only when canaries lack visits**.

```bash
# One-shot probe / heal
npm run health:probe
npm run health:daily                    # probe → heal if unhealthy
TRAFFICLENS_ADMIN_KEY=... npm run health:heal   # optional — enables POST /api/heal

# Install Mac/VPS cron (06:00 daily)
npm run health:cron
# or: bash scripts/install_trafficlens_health_cron.sh
# Custom hour: TRAFFICLENS_CRON_HOUR=7 bash scripts/install_trafficlens_health_cron.sh
```

**GitHub Actions backup:** `.github/workflows/health-daily.yml` runs at 10:00 UTC even when Mac cron is off. Add repo secret `TRAFFICLENS_ADMIN_KEY` (optional) for remote cache purge via `/api/heal`.

From Innovation workspace:
```bash
bash scripts/install_trafficlens_daily_cron.sh
node scripts/trafficlens_health_bridge.mjs
```

## 🤖 Auto-Fix Workflow

The system has a self-healing mechanism:
1.  **Daily QA** (`qa-daily.yml`) runs at 2 AM & 2 PM UTC.
2.  **On Failure:** It triggers `npm run qa:auto-fix`.
3.  **Auto-Fix Agent** (`scripts/auto-fix-agent.ts`):
    - Reads the failure report (`qa-latest-report.json`).
    - Attempts to find working selectors (for selector errors).
    - Sends an email notification with details.

## 🧠 "Reflect" Protocol

When facing a recurring issue:
1.  **Identify Pattern:** Is it random (proxy) or consistent (code bug)?
2.  **Root Cause:** Trace the error message to the exact line of code.
3.  **Systemic Fix:** Don't just patch the specific case; fix the underlying logic (e.g., add retries, increase global timeouts, enforce ordering).
4.  **Verification:** Add a specific test case to `qa-agent.ts` to prevent regression.
