#!/usr/bin/env bash
# Install TrafficLens health cron (Mac or VPS).
# Default: probe every 6h; self-heal on failure at 06:15 and 18:15 local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
LOG_DIR="${LOG_DIR:-$ROOT/.runtime/logs}"
mkdir -p "$LOG_DIR"

PROBE_LINE="0 */6 * * * cd \"$ROOT\" && \"$NODE_BIN\" scripts/trafficlens_health_probe.mjs >> \"$LOG_DIR/trafficlens_probe.log\" 2>&1"
HEAL_LINE="15 6,18 * * * cd \"$ROOT\" && \"$NODE_BIN\" scripts/trafficlens_self_heal.mjs --heal --diagnose >> \"$LOG_DIR/trafficlens_heal.log\" 2>&1"

MARK_BEGIN="# trafficlens-health-cron-begin"
MARK_END="# trafficlens-health-cron-end"

TMP="$(mktemp)"
if crontab -l 2>/dev/null | rg -v "$MARK_BEGIN|$MARK_END|trafficlens_health_probe|trafficlens_self_heal" > "$TMP"; then
  :
else
  : > "$TMP"
fi

{
  cat "$TMP"
  echo "$MARK_BEGIN"
  echo "$PROBE_LINE"
  echo "$HEAL_LINE"
  echo "$MARK_END"
} | crontab -

echo "Installed TrafficLens health cron in user crontab."
echo "Probe: every 6 hours"
echo "Self-heal + free-llm diagnose: 06:15 and 18:15 daily"
echo "Logs: $LOG_DIR"
