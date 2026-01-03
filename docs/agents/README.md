# TrafficLens Agents Documentation

This directory contains documentation for all automated agents in the TrafficLens system.

## Available Agents

### 1. QA Agent
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

### 2. Auto-Fix Agent
**Purpose:** Automatic selector error fixing  
**File:** `scripts/auto-fix-agent.ts`  
**Documentation:** [AUTO_FIX_WORKFLOW.md](./AUTO_FIX_WORKFLOW.md) | [AUTO_FIX_SUMMARY.md](./AUTO_FIX_SUMMARY.md)

- Detects selector errors automatically
- Tests alternative selectors
- Generates fix suggestions
- Saves reports to `auto-fixes/` directory

### 3. Usage Tracking Agent
**Purpose:** Daily usage reporting  
**File:** `scripts/usage-agent.ts`  
**Documentation:** See Usage section below

- Tracks daily API usage statistics
- Generates daily reports
- Sends email with usage summary

**Email Content:**
- Total Row Research
- Total Errors
- Total Visits (Sum)
- Cache Hits
- Cache Misses

### 4. Code Optimization Agent
**Purpose:** Code performance analysis  
**File:** `scripts/code-optimization-agent.ts`  
**Documentation:** [CODE_OPTIMIZATION.md](./CODE_OPTIMIZATION.md)

- Analyzes API routes for performance issues
- Checks components for bundle size
- Identifies database query optimizations
- Detects scraper performance issues

**Email Triggers:**
- Sends email when high-severity issues are found

### 5. Page Load Optimization Agent
**Purpose:** Page load performance analysis  
**File:** `scripts/page-load-optimization-agent.ts`  
**Documentation:** [PAGE_LOAD_OPTIMIZATION.md](./PAGE_LOAD_OPTIMIZATION.md)

- Analyzes Next.js pages for optimization opportunities
- Checks API routes for performance
- Identifies image/font optimization needs
- Detects bundle size issues

**Email Triggers:**
- Sends email when high-severity issues are found

## Running Agents

### Manual Execution

```bash
# QA Agent
npm run qa

# Usage Agent
npm run usage:report

# Code Optimization Agent
npm run code:optimize

# Page Load Optimization Agent
npm run page:optimize

# Auto-Fix Agent
npm run auto-fix
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
├── QA_AGENT.md
├── QA_AGENT_GUIDE.md
├── AUTO_FIX_WORKFLOW.md
├── AUTO_FIX_SUMMARY.md
├── CODE_OPTIMIZATION.md
└── PAGE_LOAD_OPTIMIZATION.md
```

## Contributing

When adding new agents:
1. Create agent script in `scripts/`
2. Add documentation in `docs/agents/`
3. Update this README
4. Add npm script in `package.json`
5. Configure email notifications if needed

