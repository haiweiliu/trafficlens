# TrafficLens QA Agent

Automated quality assurance agent that runs daily tests, detects errors, and attempts auto-fixes.

## Features

- **Daily Automated Testing**: Runs comprehensive tests on scraping, data extraction, caching, and order preservation
- **Error Detection**: Identifies common issues like scraping failures, data format errors, cache problems
- **Auto-Fix Capabilities**: Automatically fixes common issues when possible
- **Detailed Reporting**: Generates JSON reports with test results and error details

## Tests Performed

1. **Basic Scraping**: Tests that the scraper can successfully fetch data
2. **Data Extraction**: Validates that extracted data is in correct format
3. **Cache Functionality**: Ensures database caching works correctly
4. **Order Preservation**: Verifies results maintain original input order
5. **Error Handling**: Tests graceful handling of invalid domains

## Setup

### Install Dependencies

```bash
npm install tsx --save-dev
```

### Run QA Tests Manually

```bash
npm run qa
```

### Schedule Daily QA (Linux/Mac)

```bash
chmod +x scripts/setup-cron.sh
./scripts/setup-cron.sh
```

This will schedule QA tests to run daily at 2 AM.

### Schedule Daily QA (Railway/Cloud)

For Railway or other cloud platforms, you can:

1. **Use Railway Cron Jobs**: Add a cron job in Railway dashboard
2. **Use GitHub Actions**: Create a workflow that runs daily
3. **Use External Cron Service**: Use services like cron-job.org

## Reports

QA reports are saved to `qa-reports/qa-report-{timestamp}.json` with:

- Test results (passed/failed)
- Error messages
- Auto-fix status
- Detailed test information

## Auto-Fix Capabilities

The QA agent can automatically fix:

- **Stale Cache**: Clears outdated cache entries
- **Scraping Errors**: Retries with increased wait times (when applicable)
- **Data Format Issues**: Validates and corrects data formats

## Monitoring

Check logs:
```bash
tail -f logs/qa-agent.log
```

View latest report:
```bash
ls -lt qa-reports/ | head -2
```

## Integration with Monitoring

You can integrate the QA agent with:

- **Email Notifications**: Send reports on failures
- **Slack/Discord**: Post results to channels
- **Monitoring Services**: Integrate with Datadog, New Relic, etc.

## Example GitHub Actions Workflow

Create `.github/workflows/qa-daily.yml`:

```yaml
name: Daily QA Tests

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run qa
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: qa-reports
          path: qa-reports/
```

