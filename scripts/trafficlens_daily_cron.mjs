#!/usr/bin/env node
/**
 * Daily TrafficLens cron entry: probe production canaries, self-heal only if unhealthy.
 *
 * Receipts:
 *   .runtime/trafficlens-health-probe-latest.json
 *   .runtime/trafficlens-self-heal-receipt.json (when heal runs)
 *
 * Usage:
 *   node scripts/trafficlens_daily_cron.mjs
 *   TRAFFICLENS_ADMIN_KEY=... node scripts/trafficlens_daily_cron.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHealthProbe } from './trafficlens_health_probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const receipt = await runHealthProbe();

if (receipt.ok) {
  console.log(
    `[trafficlens-daily] OK — ${receipt.summary.withVisits}/${receipt.summary.total} canaries have visits`
  );
  process.exit(0);
}

console.log('[trafficlens-daily] UNHEALTHY — running self-heal + free-llm diagnose');

const result = spawnSync(
  process.execPath,
  ['scripts/trafficlens_self_heal.mjs', '--heal', '--diagnose'],
  { cwd: ROOT, stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 1);
