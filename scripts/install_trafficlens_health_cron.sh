#!/usr/bin/env bash
# Install TrafficLens daily health cron (Mac or VPS).
# Default: 06:00 local — probe canaries, self-heal + free-llm diagnose only if unhealthy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
LOG_DIR="${LOG_DIR:-$ROOT/.runtime/logs}"
CRON_HOUR="${TRAFFICLENS_CRON_HOUR:-6}"
mkdir -p "$LOG_DIR"

DAILY_LINE="0 ${CRON_HOUR} * * * cd \"$ROOT\" && \"$NODE_BIN\" scripts/trafficlens_daily_cron.mjs >> \"$LOG_DIR/trafficlens_daily.log\" 2>&1"

MARK_BEGIN="# trafficlens-health-cron-begin"
MARK_END="# trafficlens-health-cron-end"

TMP="$(mktemp)"
if crontab -l 2>/dev/null | rg -v "$MARK_BEGIN|$MARK_END|trafficlens_health_probe|trafficlens_self_heal|trafficlens_daily_cron" > "$TMP"; then
  :
else
  : > "$TMP"
fi

{
  cat "$TMP"
  echo "$MARK_BEGIN"
  echo "$DAILY_LINE"
  echo "$MARK_END"
} | crontab -

echo "Installed TrafficLens daily health cron in user crontab."
echo "Schedule: ${CRON_HOUR}:00 local — probe + conditional self-heal"
echo "Optional: TRAFFICLENS_ADMIN_KEY enables POST /api/heal (purge cache + warm canaries)"
echo "Logs: $LOG_DIR/trafficlens_daily.log"
echo "GitHub Actions backup: .github/workflows/health-daily.yml (10:00 UTC daily)"
