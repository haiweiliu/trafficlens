# TrafficLens Agents Documentation

This directory contains documentation for all automated agents in the TrafficLens system.

## Available Agents

### Phase 1: Critical Agents

#### 1. QA Agent
**Purpose:** Automated testing and error detection  
**File:** `scripts/qa-agent.ts`  
**Documentation:** [QA_AGENT.md](./QA_AGENT.md) | [QA_AGENT_GUIDE.md](./QA_AGENT_GUIDE.md)

- Runs daily tests to detect errors
- Auto-fixes common issues when possible
- Sends email notifications when errors occur
- Integrates with Auto-Fix Agent for selector errors

**Email Scenarios:**
- ✅ Errors auto-fixed → Email shows which errors were fixed
- ⚠️ Errors need manual fix → Email highlights errors requiring attention

#### 2. Auto-Fix Agent
**Purpose:** Automatic selector error fixing  
**File:** `scripts/auto-fix-agent.ts`  
**Documentation:** [AUTO_FIX_WORKFLOW.md](./AUTO_FIX_WORKFLOW.md) | [AUTO_FIX_SUMMARY.md](./AUTO_FIX_SUMMARY.md)

- Detects selector errors automatically
- Tests alternative selectors
- Generates fix suggestions
- Saves reports to `auto-fixes/` directory

#### 3. Usage Tracking Agent
**Purpose:** Daily usage reporting  
**File:** `scripts/usage-agent.ts`  

- Tracks daily API usage statistics
- Generates daily reports
- Sends email with usage summary

**Email Content:**
- Total Row Research
- Total Errors
- Total Visits (Sum)
- Cache Hits
- Cache Misses

#### 4. Code Optimization Agent
**Purpose:** Code performance analysis  
**File:** `scripts/code-optimization-agent.ts`  
**Documentation:** [CODE_OPTIMIZATION.md](./CODE_OPTIMIZATION.md)

- Analyzes API routes for performance issues
- Checks components for bundle size
- Identifies database query optimizations
- Detects scraper performance issues

**Email Triggers:**
- Sends email when high-severity issues are found

#### 5. Page Load Optimization Agent
**Purpose:** Page load performance analysis  
**File:** `scripts/page-load-optimization-agent.ts`  
**Documentation:** [PAGE_LOAD_OPTIMIZATION.md](./PAGE_LOAD_OPTIMIZATION.md)

- Analyzes Next.js pages for optimization opportunities
- Checks API routes for performance
- Identifies image/font optimization needs
- Detects bundle size issues

**Email Triggers:**
- Sends email when high-severity issues are found

### Phase 2: Important Agents

#### 6. API Health Agent
**Purpose:** Monitor API endpoints and system health  
**File:** `scripts/api-health-agent.ts`  
**Documentation:** [API_HEALTH_AGENT.md](./API_HEALTH_AGENT.md)  
**Command:** `npm run health:check`

- Tests API endpoint availability
- Verifies database connectivity
- Monitors external service (traffic.cv) health
- Tracks error rates
- Reports overall system health status

#### 7. Data Quality Agent
**Purpose:** Comprehensive data quality validation  
**File:** `scripts/data-quality-agent.ts`  
**Documentation:** [DATA_QUALITY_AGENT.md](./DATA_QUALITY_AGENT.md)  
**Command:** `npm run data:quality`

- Validates data completeness and formats
- Checks data relationships and consistency
- Detects duplicates
- Validates freshness
- Generates quality score (0-100)

#### 8. Performance Monitoring Agent
**Purpose:** Track performance metrics over time  
**File:** `scripts/performance-monitoring-agent.ts`  
**Documentation:** [PERFORMANCE_MONITORING_AGENT.md](./PERFORMANCE_MONITORING_AGENT.md)  
**Command:** `npm run performance:monitor`

- Tracks API response times (p50, p95, p99)
- Monitors cache hit rates
- Measures scraping duration
- Analyzes database query performance
- Reports performance trends

### Phase 3: Nice to Have Agents

#### 9. Cache Validation Agent
**Purpose:** Validate cache functionality  
**File:** `scripts/cache-validation-agent.ts`  
**Documentation:** [CACHE_VALIDATION_AGENT.md](./CACHE_VALIDATION_AGENT.md)  
**Command:** `npm run cache:validate`

- Tests cache hit/miss logic
- Verifies cache freshness rules
- Validates zero traffic caching
- Tests www. variations handling
- Checks cache data consistency

#### 10. Deployment Verification Agent
**Purpose:** Pre-deployment environment testing  
**File:** `scripts/deployment-verification-agent.ts`  
**Documentation:** [DEPLOYMENT_VERIFICATION_AGENT.md](./DEPLOYMENT_VERIFICATION_AGENT.md)  
**Command:** `npm run deploy:verify`

- Verifies environment variables
- Tests Node.js version compatibility
- Checks file system permissions
- Validates database connectivity
- Tests Playwright browser availability
- Blocks deployment if tests fail

#### 11. Domain Normalization Agent
**Purpose:** Comprehensive domain testing  
**File:** `scripts/domain-normalization-agent.ts`  
**Documentation:** [DOMAIN_NORMALIZATION_AGENT.md](./DOMAIN_NORMALIZATION_AGENT.md)  
**Command:** `npm run domain:test`

- Tests domain normalization logic
- Validates edge cases (punycode, subdomains, etc.)
- Tests domain matching (www. variations)
- Ensures consistent domain handling
- Validates format compliance

## Running Agents

### Manual Execution

```bash
# Phase 1: Critical Agents
npm run qa                    # QA Agent
npm run usage:report          # Usage Tracking Agent
npm run code:optimize         # Code Optimization Agent
npm run page:optimize         # Page Load Optimization Agent
npm run auto-fix              # Auto-Fix Agent

# Phase 2: Important Agents
npm run health:check          # API Health Agent
npm run data:quality          # Data Quality Agent
npm run performance:monitor   # Performance Monitoring Agent (default: 24h)
npm run performance:monitor 1h # Last hour
npm run performance:monitor 7d # Last 7 days

# Phase 3: Nice to Have Agents
npm run cache:validate        # Cache Validation Agent
npm run deploy:verify         # Deployment Verification Agent
npm run domain:test           # Domain Normalization Agent
```

### Automated Execution

Agents are configured to run automatically via:
- **GitHub Actions** (`.github/workflows/`)
- **Cron Jobs** (local/server)

## Email Notifications

All agents send email notifications to `mingcomco@gmail.com` when:
1. **Errors occur** → QA Agent notifies with fix status
2. **Daily usage** → Usage Agent sends daily summary
3. **High-severity issues** → Optimization agents notify

### Email Configuration

Set environment variable:
```bash
RESEND_API_KEY=your_api_key
EMAIL_TO=mingcomco@gmail.com
```

## Agent Workflow

```
Daily Schedule:
├── 2:00 AM UTC - QA Agent runs
│   ├── Detects errors
│   ├── Auto-fixes when possible
│   └── Sends email if errors found
│
├── 3:00 AM UTC - Usage Agent runs
│   ├── Generates daily report
│   └── Sends email with usage stats
│
└── Weekly - Optimization Agents run
    ├── Code Optimization Agent
    └── Page Load Optimization Agent
```

## Directory Structure

```
docs/agents/
├── README.md (this file)
├── CLAUDE_MD_GUIDE.md
├── SYSTEMATIC_AGENTS_PROPOSAL.md
├── Phase 1: Critical Agents
│   ├── QA_AGENT.md
│   ├── QA_AGENT_GUIDE.md
│   ├── AUTO_FIX_WORKFLOW.md
│   ├── AUTO_FIX_SUMMARY.md
│   ├── CODE_OPTIMIZATION.md
│   └── PAGE_LOAD_OPTIMIZATION.md
├── Phase 2: Important Agents
│   ├── API_HEALTH_AGENT.md
│   ├── DATA_QUALITY_AGENT.md
│   └── PERFORMANCE_MONITORING_AGENT.md
└── Phase 3: Nice to Have Agents
    ├── CACHE_VALIDATION_AGENT.md
    ├── DEPLOYMENT_VERIFICATION_AGENT.md
    └── DOMAIN_NORMALIZATION_AGENT.md
```

## Contributing

When adding new agents:
1. Create agent script in `scripts/`
2. Add documentation in `docs/agents/`
3. Update this README
4. Add npm script in `package.json`
5. Configure email notifications if needed

