#!/usr/bin/env node
/**
 * TrafficLens production health probe.
 *
 * Receipt: TrafficLens/.runtime/trafficlens-health-probe-latest.json
 *
 * Usage:
 *   node scripts/trafficlens_health_probe.mjs
 *   TRAFFICLENS_URL=https://trafficlens.up.railway.app node scripts/trafficlens_health_probe.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECEIPT_PATH = path.join(ROOT, '.runtime/trafficlens-health-probe-latest.json');

const BASE_URL = (process.env.TRAFFICLENS_URL || 'https://trafficlens.up.railway.app').replace(/\/$/, '');
const CANARIES = (process.env.TRAFFICLENS_CANARY_DOMAINS || 'threads.com,github.com,google.com')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);
const WAIT_MS = Math.max(15000, Number(process.env.TL_PROBE_WAIT_MS || 90000));
const REQUEST_TIMEOUT_MS = Math.max(8000, Number(process.env.TL_PROBE_TIMEOUT_MS || 30000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postTraffic(domains, bypassCache = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/api/traffic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domains, bypassCache, dryRun: false }),
      signal: controller.signal,
    });
    const json = await response.json();
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function scoreResults(results = []) {
  const withVisits = results.filter(
    (row) => row.monthlyVisits !== null && row.monthlyVisits !== undefined && row.monthlyVisits > 0
  ).length;
  const complete = results.filter(
    (row) => row.monthlyVisits !== null && row.monthlyVisits !== undefined
  ).length;
  const pending = results.filter((row) => row.error === 'Scraping in background...').length;
  return { withVisits, complete, pending, total: results.length };
}

export async function runHealthProbe() {
  const startedAt = new Date().toISOString();
  const receipt = {
    ok: false,
    startedAt,
    baseUrl: BASE_URL,
    canaries: CANARIES,
    phases: [],
    summary: {},
  };

  const kickoff = await postTraffic(CANARIES, true);
  receipt.phases.push({ name: 'kickoff', status: kickoff.status, metadata: kickoff.json?.metadata || null });

  if (kickoff.status !== 200) {
    receipt.summary = { error: `API ${kickoff.status}`, unhealthy: ['api_unreachable'] };
    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  }

  await sleep(WAIT_MS);

  const verify = await postTraffic(CANARIES, false);
  const results = verify.json?.results || [];
  const score = scoreResults(results);

  receipt.phases.push({
    name: 'verify',
    status: verify.status,
    score,
    results,
  });

  const minVisits = Math.max(1, Math.ceil(CANARIES.length * 0.66));
  receipt.ok = score.withVisits >= minVisits;
  receipt.summary = {
    withVisits: score.withVisits,
    required: minVisits,
    complete: score.complete,
    pending: score.pending,
    unhealthy: receipt.ok ? [] : ['null_monthly_visits'],
  };
  receipt.finishedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

const dryRun = process.argv.includes('--dry-run');

const receipt = await runHealthProbe();
if (receipt.ok) {
  console.log(`[trafficlens-probe] OK — ${receipt.summary.withVisits}/${CANARIES.length} canaries have visits`);
  process.exit(0);
}

console.error(`[trafficlens-probe] UNHEALTHY — ${JSON.stringify(receipt.summary)}`);
process.exit(dryRun ? 0 : 1);
