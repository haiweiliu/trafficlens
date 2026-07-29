#!/usr/bin/env node
/**
 * TrafficLens safe self-heal (Detect → Heal → Verify → free-llm diagnose on failure).
 *
 * Probe receipt: TrafficLens/.runtime/trafficlens-health-probe-latest.json
 * Heal receipt:  TrafficLens/.runtime/trafficlens-self-heal-receipt.json
 *
 * Usage:
 *   node scripts/trafficlens_self_heal.mjs --heal
 *   node scripts/trafficlens_self_heal.mjs --heal --diagnose
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHealthProbe } from './trafficlens_health_probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INNOVATION_ROOT = fs.existsSync('/root/Innovation')
  ? '/root/Innovation'
  : fs.existsSync('/root/projects/innovation')
    ? '/root/projects/innovation'
    : path.resolve(ROOT, '..', 'Innovation');
const HEAL_RECEIPT_PATH = path.join(ROOT, '.runtime/trafficlens-self-heal-receipt.json');
const FREE_LLM_CLIENT = path.join(
  INNOVATION_ROOT,
  '.agent/skills/free-llm/scripts/free_llm_client.mjs'
);

const BASE_URL = (process.env.TRAFFICLENS_URL || 'https://trafficlens.up.railway.app').replace(/\/$/, '');
const ADMIN_KEY = process.env.TRAFFICLENS_ADMIN_KEY || '';

function parseArgs(argv) {
  return {
    heal: argv.includes('--heal'),
    diagnose: argv.includes('--diagnose'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function callHealEndpoint() {
  if (!ADMIN_KEY) {
    return { skipped: true, reason: 'TRAFFICLENS_ADMIN_KEY not set' };
  }

  const response = await fetch(`${BASE_URL}/api/heal`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-trafficlens-admin-key': ADMIN_KEY,
    },
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function runFreeLlmDiagnose(probeReceipt) {
  if (!fs.existsSync(FREE_LLM_CLIENT)) {
    return {
      skipped: true,
      reason: `free-llm client missing at ${FREE_LLM_CLIENT}`,
    };
  }

  try {
    const { freeLlmJson } = await import(FREE_LLM_CLIENT);
    const prompt = `TrafficLens health probe failed. Return JSON with keys status, summary, root_cause, recommended_action, confidence (0-1).

Base URL: ${BASE_URL}
Probe summary: ${JSON.stringify(probeReceipt.summary)}
Sample results: ${JSON.stringify(probeReceipt.phases?.[1]?.results || []).slice(0, 1200)}

Known pattern: monthlyVisits null while avgSessionDuration populated = broken Playwright DOM scrape; fix is flight-chunk proxy fetch via TRAFFIC_CV_PROXY_URL and purge incomplete cache.`;

    return await freeLlmJson('json-structured', prompt);
  } catch (error) {
    return {
      skipped: true,
      reason: error instanceof Error ? error.message : 'free-llm diagnose failed',
    };
  }
}

const args = parseArgs(process.argv.slice(2));
const probeReceipt = await runHealthProbe();

if (probeReceipt.ok) {
  console.log('[trafficlens-self-heal] Probe OK');
  if (!args.heal) process.exit(0);
}

if (!args.heal) {
  console.error('[trafficlens-self-heal] Unhealthy — run with --heal');
  process.exit(args.dryRun ? 0 : 1);
}

const healReceipt = {
  startedAt: new Date().toISOString(),
  probe: probeReceipt.summary,
  actions: [],
  diagnose: null,
  verify: null,
};

if (!args.dryRun) {
  const heal = await callHealEndpoint();
  healReceipt.actions.push({ type: 'api_heal', result: heal });
} else {
  healReceipt.actions.push({ type: 'api_heal', dryRun: true });
}

const verifyReceipt = await runHealthProbe();
healReceipt.verify = verifyReceipt.summary;

if (args.diagnose && !verifyReceipt.ok) {
  healReceipt.diagnose = await runFreeLlmDiagnose(verifyReceipt);
}

healReceipt.finishedAt = new Date().toISOString();
healReceipt.ok = verifyReceipt.ok;

fs.mkdirSync(path.dirname(HEAL_RECEIPT_PATH), { recursive: true });
fs.writeFileSync(HEAL_RECEIPT_PATH, `${JSON.stringify(healReceipt, null, 2)}\n`);

console.log(`[trafficlens-self-heal] Receipt → ${HEAL_RECEIPT_PATH}`);
console.log(JSON.stringify({ ok: healReceipt.ok, actions: healReceipt.actions, verify: healReceipt.verify }, null, 2));

process.exit(healReceipt.ok || args.dryRun ? 0 : 1);
