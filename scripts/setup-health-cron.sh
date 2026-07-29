#!/bin/bash

# ============================================================
# Setup TrafficLens Playwright Health Monitor Cron
# ============================================================
# Schedules the health check every 15 minutes.
# Requires RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID in .env.local
#
# Usage: bash scripts/setup-health-cron.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Health check every 15 minutes
HEALTH_CRON="*/15 * * * * cd $PROJECT_DIR && npx tsx scripts/playwright-health-cron.ts >> logs/health-cron.log 2>&1"

echo "📋 Setting up TrafficLens health monitor cron..."
echo ""
echo "Project: $PROJECT_DIR"
echo "Schedule: Every 15 minutes"
echo ""

# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "playwright-health-cron"; then
  echo "⚠️  Health cron already exists. Skipping duplicate registration."
  echo "   To update, run: crontab -e"
else
  (crontab -l 2>/dev/null; echo "$HEALTH_CRON") | crontab -
  echo "✅ Health monitor cron installed!"
fi

echo ""
echo "Required environment variables in .env.local:"
echo "  RAILWAY_API_TOKEN       - Railway API token (from Railway dashboard > Account > API Tokens)"
echo "  RAILWAY_SERVICE_ID      - Service ID from Railway dashboard URL"
echo "  RAILWAY_ENVIRONMENT_ID  - Environment ID from Railway dashboard"
echo "  RESEND_API_KEY          - Resend.com API key for email alerts"
echo "  EMAIL_TO                - Email to receive alerts"
echo "  RAILWAY_PUBLIC_URL      - Full URL of your Railway deployment"
echo ""
echo "Logs: $PROJECT_DIR/logs/health-cron.log"
echo ""
echo "To test now:    npx tsx scripts/playwright-health-cron.ts"
echo "To view logs:   tail -f $PROJECT_DIR/logs/health-cron.log"
echo "To remove:      crontab -e (delete the playwright-health-cron line)"
