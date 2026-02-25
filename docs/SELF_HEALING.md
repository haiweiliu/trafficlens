# TrafficLens Self-Healing Architecture
**Last Updated**: 2026-02-25

## Overview
TrafficLens employs a multi-layered self-healing strategy to ensure high availability and data integrity without manual intervention.

---

## Layer 1: Code Resilience (The "Auto-Fixer")

### Mechanism
- **Script**: `scripts/gemini-qa-healer.ts`
- **Engine**: Gemini 1.0 Pro
- **Trigger**: Run automatically when `npm run qa` fails (via `scripts/run-qa.sh`).

### Workflow
1.  **Failure Detection**: Cron job runs QA. If exit code != 0, it calls the Healer.
2.  **Diagnosis**: Healer reads the crash logs + source code (`scraper.ts`, `qa-agent.ts`).
3.  **AI Analysis**: Gemini diagnoses the root cause and generates a JSON-based code fix.
4.  **Proposal**:
    - **Saves**: `logs/proposed-fix.json`
    - **Notifies**: Sends email via Resend with "QA Fix Proposed" subject.
5.  **Manual Review**: Admin reviews the JSON and applies the fix if valid.
    *(Auto-push has been disabled for security).*

### Security & Config
- **Secrets**: MUST be in `.env.local` (Git-ignored).
    - `GEMINI_API_KEY`: Required for analysis.
    - `RESEND_API_KEY`: Required for notifications.
- **Reference**: See `scripts/gemini-qa-healer.ts` for implementation.

---

## Layer 2: Infrastructure Resilience (VPS Sentinel)

### Mechanism
- **Script**: `scripts/affiliate-pipeline/cloud_sentinel_v4.mjs`
- **Engine**: Gemini 1.5 Pro (via `cloud-ai-healer` skill)
- **Scope**: Monitors the Affiliate Pipeline & System Health.

### Features
- **Zombie Cleanup**: Kills stuck Chrome processes.
- **Memory Management**: Restarts pipelines if DOM usage exceeds 1GB.
- **Ghost Chunks**: Detects stalled scraping chunks and resets them.
- **AI Repair**: If logs show complex errors (e.g., Cloudflare changes), it calls `ai_repair.mjs` to analyze and fix.

---

## Layer 3: Proxy Resilience (Direct Connect)

### Mechanism
- **Policy**: `useProxy: false` (Direct Connection)
- **Rationale**: Railway and standard datacenter proxies are often blocked by improved anti-bot systems.
- **Implementation**:
    - **QA Agent**: Explicitly disables proxy (`scrapeTrafficData(..., false, false)`).
    - **UI API**: Explicitly disables proxy to ensure user requests succeed.
    - **Scraper**: If `proxyConfig === null`, it injects `--no-proxy-server` to bypass environment defaults.

---

## Layer 4: Railway Playwright Health Monitor (Auto-Redeploy)

### Mechanism
- **Script**: `scripts/playwright-health-cron.ts`
- **Cron**: Every 15 minutes (`npm run health:check`)
- **Trigger**: SIGTRAP / `pthread_create: Resource temporarily unavailable` errors

### Why This Exists
Railway's free-tier containers impose strict OS thread limits (`ulimit -u ≈ 512`).  
Next.js + Chromium exceeds this limit under sustained use, causing `SIGTRAP` crashes.  
This cron detects the failure and auto-restarts the Railway container to restore service.

### Workflow
1. Every 15 minutes, probe `POST /api/traffic` with 3 known domains.
2. Wait 30s for background scrape.
3. Poll `GET /api/traffic/update` for results.
4. If any result contains `SIGTRAP` or `pthread_create`:
   - **Auto-trigger Railway redeploy** via GraphQL API (`serviceInstanceRedeploy`).
   - **Send email alert** via Resend.
   - Observe 10-minute cooldown before next redeploy.
5. Log everything to `logs/health-cron.log`.

### Required `.env.local` Variables
```bash
RAILWAY_API_TOKEN=...       # From Railway dashboard > Account > API Tokens
RAILWAY_SERVICE_ID=...      # From Railway dashboard service URL
RAILWAY_ENVIRONMENT_ID=...  # From Railway dashboard environment URL
RAILWAY_PUBLIC_URL=https://trafficlens.up.railway.app
RESEND_API_KEY=...
EMAIL_TO=your@email.com
```

### Setup
```bash
# Install cron (macOS: must open crontab manually due to permissions)
crontab -e
# Add:
# */15 * * * * cd /path/to/TrafficLens && npx tsx scripts/playwright-health-cron.ts >> logs/health-cron.log 2>&1
```

### Test Manually
```bash
npm run health:check
```

---

## Manual Overrides

### Force QA Run (with Auto-Heal)
```bash
# On VPS or Local
bash scripts/run-qa.sh
```

### Check Logs
```bash
tail -f TrafficLens/logs/qa-latest.log
tail -f TrafficLens/logs/health-cron.log
```

### Update Cron Schedule
```bash
# Default: Hourly QA
bash scripts/setup-cron.sh
# Playwright health: Every 15 min
bash scripts/setup-health-cron.sh
```


## Overview
TrafficLens employs a multi-layered self-healing strategy to ensure high availability and data integrity without manual intervention.

---

## Layer 1: Code Resilience (The "Auto-Fixer")

### Mechanism
- **Script**: `scripts/gemini-qa-healer.ts`
- **Engine**: Gemini 1.0 Pro
- **Trigger**: Run automatically when `npm run qa` fails (via `scripts/run-qa.sh`).

### Workflow
1.  **Failure Detection**: Cron job runs QA. If exit code != 0, it calls the Healer.
2.  **Diagnosis**: Healer reads the crash logs + source code (`scraper.ts`, `qa-agent.ts`).
3.  **AI Analysis**: Gemini diagnoses the root cause and generates a JSON-based code fix.
4.  **Proposal**:
    - **Saves**: `logs/proposed-fix.json`
    - **Notifies**: Sends email via Resend with "QA Fix Proposed" subject.
5.  **Manual Review**: Admin reviews the JSON and applies the fix if valid.
    *(Auto-push has been disabled for security).*

### Security & Config
- **Secrets**: MUST be in `.env.local` (Git-ignored).
    - `GEMINI_API_KEY`: Required for analysis.
    - `RESEND_API_KEY`: Required for notifications.
- **Reference**: See `scripts/gemini-qa-healer.ts` for implementation.

---

## Layer 2: Infrastructure Resilience (VPS Sentinel)

### Mechanism
- **Script**: `scripts/affiliate-pipeline/cloud_sentinel_v4.mjs`
- **Engine**: Gemini 1.5 Pro (via `cloud-ai-healer` skill)
- **Scope**: Monitors the Affiliate Pipeline & System Health.

### Features
- **Zombie Cleanup**: Kills stuck Chrome processes.
- **Memory Management**: Restarts pipelines if DOM usage exceeds 1GB.
- **Ghost Chunks**: Detects stalled scraping chunks and resets them.
- **AI Repair**: If logs show complex errors (e.g., Cloudflare changes), it calls `ai_repair.mjs` to analyze and fix.

---

## Layer 3: Proxy Resilience (Direct Connect)

### Mechanism
- **Policy**: `useProxy: false` (Direct Connection)
- **Rationale**: Railway and standard datacenter proxies are often blocked by improved anti-bot systems.
- **Implementation**:
    - **QA Agent**: Explicitly disables proxy (`scrapeTrafficData(..., false, false)`).
    - **UI API**: Explicitly disables proxy to ensure user requests succeed.
    - **Scraper**: If `proxyConfig === null`, it injects `--no-proxy-server` to bypass environment defaults.

---

## Manual Overrides

### Force QA Run (with Auto-Heal)
```bash
# On VPS or Local
bash scripts/run-qa.sh
```

### Check Logs
```bash
tail -f TrafficLens/logs/qa-latest.log
```

### Update Cron Schedule
```bash
# Default: Hourly
bash scripts/setup-cron.sh
```
