#!/bin/bash

# Daily QA Agent Runner
# This script runs the QA agent and can be scheduled via cron

cd "$(dirname "$0")/.."

echo "========================================="
echo "TrafficLens QA Agent - $(date)"
echo "========================================="

# Run QA tests
npm run qa

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ QA tests passed"
else
  echo "❌ QA tests failed - check logs"
  # Could add notification here (email, Slack, etc.)
fi

echo "========================================="

