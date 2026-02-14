#!/bin/bash

# Setup daily QA agent cron job
# Run this script once to schedule daily QA tests

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRON_JOB="0 * * * * cd $SCRIPT_DIR/.. && npm run qa:daily >> logs/qa-agent.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Daily QA agent scheduled (runs at 2 AM daily)"
echo "Cron job: $CRON_JOB"
echo ""
echo "To view logs: tail -f logs/qa-agent.log"
echo "To remove: crontab -e (then delete the line)"

