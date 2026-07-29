#!/bin/bash

# Daily QA Agent Runner
# This script runs the QA agent and can be scheduled via cron

cd "$(dirname "$0")/.."

echo "========================================="
echo "TrafficLens QA Agent - $(date)"
echo "TrafficLens QA Agent - $(date)"
echo "========================================="

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Run QA tests and capture logs
mkdir -p logs
npm run qa > logs/qa-latest.log 2>&1
QA_STATUS=$?

# Check exit code
if [ $QA_STATUS -eq 0 ]; then
  echo "✅ QA tests passed"
else
  echo "❌ QA tests failed"
  echo "🚑 Triggering Gemini Auto-Healer..."
  npx tsx scripts/gemini-qa-healer.ts
fi

echo "========================================="

