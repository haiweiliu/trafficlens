/**
 * TrafficLens Playwright Health Monitor Cron
 * ============================================
 * Runs periodically to detect SIGTRAP / OOM crashes from Railway.
 * If detected, auto-triggers a Railway redeploy + sends an email alert.
 *
 * Cron: Every 15 minutes (set up via scripts/setup-health-cron.sh)
 * Usage: tsx scripts/playwright-health-cron.ts
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

const RAILWAY_URL = process.env.RAILWAY_PUBLIC_URL || 'https://trafficlens.up.railway.app';
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN || '';
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID || '';
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_TO = process.env.EMAIL_TO || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'alerts@resend.dev';

// Probe domains (well-known, high-traffic sites for reliability)
const PROBE_DOMAINS = ['amazon.com', 'google.com', 'netflix.com'];
const SIGTRAP_INDICATORS = ['SIGTRAP', 'pthread_create', 'browserType.launch', 'Target page, context or browser has been closed'];

const LOGS_DIR = path.join(process.cwd(), 'logs');
const HEALTH_LOG = path.join(LOGS_DIR, 'health-cron.log');
const LAST_REDEPLOY_FILE = path.join(LOGS_DIR, '.last-redeploy-ts');

// Minimum 10 minutes between redeploys to avoid deploy spam
const REDEPLOY_COOLDOWN_MS = 10 * 60 * 1000;

function log(msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.appendFileSync(HEALTH_LOG, line + '\n');
}

function isSigtrap(error: string): boolean {
    return SIGTRAP_INDICATORS.some(indicator => error.includes(indicator));
}

function isOnCooldown(): boolean {
    if (!fs.existsSync(LAST_REDEPLOY_FILE)) return false;
    const lastTs = parseInt(fs.readFileSync(LAST_REDEPLOY_FILE, 'utf8').trim(), 10);
    return Date.now() - lastTs < REDEPLOY_COOLDOWN_MS;
}

function markRedeploy() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.writeFileSync(LAST_REDEPLOY_FILE, Date.now().toString());
}

async function probe(): Promise<{ ok: boolean; details: string }> {
    try {
        log(`Probing ${RAILWAY_URL}/api/traffic with domains: ${PROBE_DOMAINS.join(', ')}`);

        const resp = await fetch(`${RAILWAY_URL}/api/traffic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains: PROBE_DOMAINS, bypassCache: true }),
            signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
            return { ok: false, details: `HTTP ${resp.status} from /api/traffic` };
        }

        const data = await resp.json() as any;
        const results = data.results || [];

        // Wait 30s for background scrape to complete
        log('Waiting 30s for background scrape...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Poll update endpoint
        const updateResp = await fetch(
            `${RAILWAY_URL}/api/traffic/update?domains=${PROBE_DOMAINS.join(',')}`,
            { signal: AbortSignal.timeout(15000) }
        );
        const updateData = await updateResp.json() as any;
        const updateResults = updateData.results || [];

        // Check for SIGTRAP errors in results
        for (const r of updateResults) {
            if (r.error && isSigtrap(r.error)) {
                return {
                    ok: false,
                    details: `SIGTRAP detected for domain ${r.domain}: ${r.error.slice(0, 200)}`
                };
            }
        }

        // Check if at least 1 domain returned data
        const hasData = updateResults.some((r: any) => r.monthlyVisits !== null && !r.error);
        if (!hasData) {
            // Could still be scraping — not necessarily a SIGTRAP
            const hasOtherErrors = updateResults.some((r: any) => r.error && !r.error.includes('background'));
            if (hasOtherErrors) {
                return { ok: false, details: 'Scrape completed but returned all errors.' };
            }
            return { ok: true, details: 'Scrape in progress, no SIGTRAP detected.' };
        }

        return { ok: true, details: `${updateResults.filter((r: any) => r.monthlyVisits !== null).length}/${PROBE_DOMAINS.length} domains scraped successfully.` };
    } catch (err: any) {
        return { ok: false, details: `Probe threw: ${err.message}` };
    }
}

async function triggerRailwayRedeploy(): Promise<boolean> {
    if (!RAILWAY_TOKEN || !RAILWAY_SERVICE_ID || !RAILWAY_ENVIRONMENT_ID) {
        log('⚠️  RAILWAY_API_TOKEN / SERVICE_ID / ENVIRONMENT_ID not set — cannot auto-redeploy.');
        return false;
    }

    const mutation = `
    mutation {
      serviceInstanceRedeploy(
        serviceId: "${RAILWAY_SERVICE_ID}",
        environmentId: "${RAILWAY_ENVIRONMENT_ID}"
      )
    }
  `;

    try {
        const resp = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RAILWAY_TOKEN}`,
            },
            body: JSON.stringify({ query: mutation }),
            signal: AbortSignal.timeout(15000),
        });

        const data = await resp.json() as any;
        if (data.errors) {
            log(`❌ Railway redeploy API error: ${JSON.stringify(data.errors)}`);
            return false;
        }

        markRedeploy();
        log('✅ Railway redeploy triggered successfully via API.');
        return true;
    } catch (err: any) {
        log(`❌ Failed to trigger redeploy: ${err.message}`);
        return false;
    }
}

async function sendAlert(subject: string, body: string) {
    if (!RESEND_API_KEY || !EMAIL_TO) {
        log('⚠️  Email not configured — skipping alert.');
        return;
    }

    try {
        const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: EMAIL_TO,
                subject,
                html: `<pre style="font-family:monospace;white-space:pre-wrap;">${body}\n\nTimestamp: ${new Date().toISOString()}</pre>`,
            }),
        });

        if (resp.ok) {
            log(`📧 Alert email sent: "${subject}"`);
        } else {
            const txt = await resp.text();
            log(`⚠️  Email send failed: ${txt}`);
        }
    } catch (err: any) {
        log(`⚠️  Email error: ${err.message}`);
    }
}

async function main() {
    log('=== TrafficLens Playwright Health Check ===');

    const { ok, details } = await probe();

    if (ok) {
        log(`✅ Health check PASSED: ${details}`);
        return;
    }

    log(`❌ Health check FAILED: ${details}`);

    // Determine if it's a SIGTRAP crash
    const isCrash = isSigtrap(details);

    if (isCrash) {
        log('🚨 SIGTRAP/pthread_create crash detected — Railway container is out of threads!');

        if (isOnCooldown()) {
            log('⏳ Skipping redeploy — cooldown active (10 min between redeploys).');
        } else {
            log('🔄 Triggering Railway redeploy to get a fresh container...');
            const redeployed = await triggerRailwayRedeploy();
            await sendAlert(
                '🚨 TrafficLens: SIGTRAP Detected — Auto-Redeploy Triggered',
                `Playwright crash detected on Railway.\n\nDetails:\n${details}\n\nAction: ${redeployed ? 'Auto-redeploy triggered via Railway API.' : 'Could not auto-redeploy — check RAILWAY_API_TOKEN env var.'}`
            );
        }
    } else {
        log(`⚠️  Non-crash failure: ${details}`);
        await sendAlert(
            '⚠️ TrafficLens: Health Check Failed',
            `Playwright health check failed (non-crash).\n\nDetails:\n${details}\n\nNo auto-action taken — manual investigation needed.`
        );
    }
}

main().catch(err => {
    log(`Fatal error in health cron: ${err.message}`);
    process.exit(1);
});
