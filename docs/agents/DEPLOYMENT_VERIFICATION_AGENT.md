# Deployment Verification Agent

## Overview
Pre-deployment environment testing to catch issues before production deployment.

## Purpose
Reduce production incidents by verifying environment setup before deployment.

## What It Does

### Verification Tests

1. **Environment Variables**
   - Checks required environment variables
   - Validates configuration
   - Lists optional variables

2. **Node.js Version**
   - Verifies Node.js >= 20.9.0
   - Checks version compatibility

3. **File System Permissions**
   - Tests write permissions
   - Validates database directory access
   - Ensures file system is writable

4. **Database Connectivity**
   - Tests database connection
   - Validates schema exists
   - Checks table availability

5. **Browser Availability (Playwright)**
   - Tests Playwright installation
   - Launches headless browser
   - Validates browser functionality

6. **API Endpoints** (optional)
   - Tests API endpoint availability
   - Validates response format
   - Checks server health

## Usage

### Run Locally (Pre-Deployment)
```bash
npm run deploy:verify
```

### In CI/CD Pipeline
```yaml
# Example GitHub Actions
- name: Verify Deployment
  run: npm run deploy:verify
```

### Exit Codes
- `0` - All tests passed, can deploy ✅
- `1` - Tests failed, deployment blocked ❌

## Output

### Verification Report
- Environment (development/production)
- Individual test results
- Passed/failed counts
- Can deploy status
- Error details

## Examples

### All Tests Passed
```
📊 Deployment Verification Report:
Environment: production
Total Tests: 6
Passed: 6
Failed: 0
Can Deploy: ✅ YES
✅ Environment Variables
✅ Node.js Version (v20.9.0)
✅ File System Permissions
✅ Database Connectivity
✅ Browser Availability (Playwright)
✅ API Endpoints
```

### Deployment Blocked
```
📊 Deployment Verification Report:
Environment: production
Total Tests: 6
Passed: 4
Failed: 2
Can Deploy: ❌ NO

✅ Environment Variables
✅ Node.js Version (v20.9.0)
❌ File System Permissions
   Error: Cannot write to /data
❌ Browser Availability (Playwright)
   Error: Executable doesn't exist
✅ Database Connectivity
✅ API Endpoints

⚠️  Deployment blocked due to failed tests
```

## Test Details

### Environment Variables Test
- Required: `NODE_ENV`
- Optional: `DATABASE_PATH`, `RESEND_API_KEY`, etc.
- Fails if required variables missing

### Node.js Version Test
- Requires Node.js >= 20.9.0
- Validates version compatibility
- Fails if version too old

### File System Permissions Test
- Tests write access to database directory
- Creates/removes test file
- Fails if cannot write

### Database Connectivity Test
- Tests database connection
- Validates schema (traffic_latest, traffic_snapshots tables)
- Fails if database unavailable

### Browser Availability Test
- Launches Playwright Chromium
- Tests browser functionality
- Fails if browser not installed or broken

### API Endpoints Test
- Tests `/api/traffic` endpoint (if server running)
- Validates response format
- Skips if server not available (normal for pre-deployment)

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Deploy Verification

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run deploy:verify
```

### Railway Pre-Deploy Hook
```json
{
  "build": {
    "command": "npm run build",
    "watchPatterns": ["**"]
  },
  "deploy": {
    "startCommand": "npm run deploy:verify && npm start"
  }
}
```

## Best Practices
1. Run before every deployment
2. Include in CI/CD pipelines
3. Test in staging environment first
4. Fix failures before deploying
5. Monitor deployment verification trends
6. Update tests as environment changes

## Common Failures & Fixes

| Failure | Fix |
|---------|-----|
| Browser not installed | Run `npx playwright install chromium` |
| Database not accessible | Check DATABASE_PATH, verify permissions |
| File system not writable | Check directory permissions, mount points |
| Node.js version too old | Upgrade to Node.js 20.9.0+ |
| Missing env vars | Set required environment variables |

---

*Part of Phase 3: Nice to Have Agents*

