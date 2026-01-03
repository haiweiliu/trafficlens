# TrafficLens Agents Documentation (Consolidated)

## Overview
After evaluation and consolidation, TrafficLens now uses **3 essential agents** (down from 12) focused on core functionality.

---

## Essential Agents (3)

### 1. QA Agent ⭐⭐⭐⭐⭐
**Purpose**: Core reliability and error detection  
**File**: `scripts/qa-agent.ts`  
**Command**: `npm run qa`

**What it does**:
- Tests scraping functionality
- Tests data extraction accuracy
- Tests cache functionality (enhanced with validation tests)
- Tests order preservation
- Tests error handling
- Auto-fixes common issues (via Auto-Fix Agent integration)
- Sends email notifications on errors

**When to run**:
- Daily (automated via cron/GitHub Actions)
- Before deployments
- When errors are suspected

---

### 2. Data Quality Agent ⭐⭐⭐⭐
**Purpose**: Ensures accurate data extraction  
**File**: `scripts/data-quality-agent.ts`  
**Command**: `npm run data:quality`

**What it does**:
- Validates data completeness
- Checks data formats (visits, bounce rate, duration, etc.)
- Validates data relationships
- Detects duplicates
- Checks data freshness
- Generates quality score (0-100)

**When to run**:
- Weekly or monthly
- After data extraction changes
- When data quality issues are suspected

---

### 3. Pre-Deployment Validation Agent ⭐⭐⭐⭐⭐
**Purpose**: Prevents deployment failures  
**File**: `scripts/pre-deployment-agent.ts`  
**Command**: `npm run pre-deploy`

**What it does**:
- Validates TypeScript compilation
- Tests Next.js build
- Checks exports and imports
- Validates Map vs Array usage
- **Environment verification** (merged from Deployment Verification Agent):
  - Node.js version
  - File system permissions
  - Database connectivity
  - Browser availability (Playwright)

**When to run**:
- **Before every push** (recommended: pre-push git hook)
- Before deployments
- When code changes are made

---

## Running Agents

### Manual Execution
```bash
# QA Agent (reliability)
npm run qa

# Data Quality Agent (accuracy)
npm run data:quality

# Pre-Deployment Validation (deployment)
npm run pre-deploy
```

### Automated Execution
- **QA Agent**: Daily via GitHub Actions or cron
- **Data Quality Agent**: Weekly or monthly
- **Pre-Deployment Validation**: Pre-push git hook (recommended)

---

## Helper Agents (Internal Use)

### Auto-Fix Agent
- **File**: `scripts/auto-fix-agent.ts`
- **Purpose**: Fixes selector errors automatically
- **Used by**: QA Agent (called internally)
- **Status**: Helper, not run directly

### Deep-Fix Agent
- **File**: `scripts/deep-fix-agent.ts`
- **Purpose**: Advanced error fixing with multiple strategies
- **Used by**: QA Agent (called internally)
- **Status**: Helper, not run directly

---

## Consolidation Summary

**Before**: 12 agents  
**After**: 3 essential agents  
**Reduction**: 75%

**Removed agents** (not core purpose or merged):
- Usage Tracking Agent
- Code Optimization Agent
- Page Load Optimization Agent
- Performance Monitoring Agent
- Domain Normalization Agent
- Cache Validation Agent (merged into QA)
- Deployment Verification Agent (merged into Pre-Deploy)
- API Health Agent (removed - over-engineering)

**Result**: Simpler, faster, more focused system aligned with core purpose.

---

## Core Purpose Alignment

**TrafficLens Core Requirements**:
1. ✅ **Accurate data extraction** → Data Quality Agent
2. ✅ **Reliable scraping** → QA Agent
3. ✅ **Successful deployments** → Pre-Deployment Validation Agent

**Perfect alignment**: 3 agents for 3 core requirements.

---

## Documentation

- **Evaluation**: [AGENT_EVALUATION.md](./AGENT_EVALUATION.md)
- **Consolidation Summary**: [CONSOLIDATION_SUMMARY.md](./CONSOLIDATION_SUMMARY.md)
- **QA Agent**: [QA_AGENT.md](./QA_AGENT.md) | [QA_AGENT_GUIDE.md](./QA_AGENT_GUIDE.md)
- **Data Quality**: [DATA_QUALITY_AGENT.md](./DATA_QUALITY_AGENT.md)
- **Pre-Deployment**: [PRE_DEPLOYMENT_AGENT.md](./PRE_DEPLOYMENT_AGENT.md)

---

*Last updated: After consolidation (12 → 3 agents)*

