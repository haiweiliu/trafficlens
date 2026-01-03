# Data Quality Agent

## Overview
Comprehensive data quality checks to ensure data completeness, formats, relationships, and freshness.

## Purpose
Catch data extraction bugs early and ensure high data quality.

## What It Does

### Validation Checks

1. **Completeness**
   - Required fields present (domain, monthlyVisits, checkedAt)
   - No missing critical data

2. **Format Validation**
   - Monthly visits: non-negative numbers
   - Bounce rate: 0-100% range
   - Pages per visit: > 0
   - Duration: HH:MM:SS format
   - Domain: valid domain structure
   - Timestamps: valid ISO format

3. **Data Relationships**
   - Monthly visits match historical trends
   - Duration seconds match formatted duration
   - Consistency checks

4. **Duplicate Detection**
   - Identifies duplicate domain entries
   - Flags inconsistencies

5. **Freshness Checks**
   - Data age validation
   - Stale data detection (> 35 days)

## Usage

### Run Locally
```bash
npm run data:quality
```

### With Custom Sample Size
```typescript
import { runDataQualityChecks } from './scripts/data-quality-agent';

const report = await runDataQualityChecks(200); // Check 200 domains
```

## Output

### Quality Report
- Total domains checked
- Quality score (0-100)
- Critical issues count
- Warnings count
- Info messages count
- Detailed issue list

### Quality Score Calculation
```
Quality Score = 100 - (total_issues / max_issues) * 100
```

### Severity Levels
- **Critical** ❌ - Data integrity issues (negative visits, invalid formats)
- **Warning** ⚠️ - Data quality concerns (format mismatches, deviations)
- **Info** ℹ️ - Informational (stale data, minor inconsistencies)

## Examples

### Good Quality Data
```
📊 Data Quality Report:
Total Domains Checked: 100
Quality Score: 98/100
Critical Issues: 0
Warnings: 2
Info: 5
```

### Poor Quality Data
```
📊 Data Quality Report:
Total Domains Checked: 100
Quality Score: 75/100
Critical Issues: 5
Warnings: 15
Info: 10

❌ Critical Issues:
  • example.com.monthlyVisits: Negative value (impossible)
  • test.com.bounceRate: Out of range (0-100%)
  • sample.com.pagesPerVisit: Invalid value (must be > 0)
```

## Validation Rules

### Monthly Visits
- Type: number
- Range: >= 0
- Null allowed: yes (for errors)

### Bounce Rate
- Type: number
- Range: 0-100
- Null allowed: yes

### Pages Per Visit
- Type: number
- Range: > 0
- Null allowed: yes

### Avg Session Duration
- Format: HH:MM:SS
- Regex: `/^\d{2}:\d{2}:\d{2}$/`
- Null allowed: yes

### Domain Format
- Regex: `/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i`
- Must be valid domain structure

## Integration with Other Agents
- Used by **QA Agent** for data validation
- Feeds into **Error Pattern Analysis Agent**
- Informs **Performance Monitoring Agent** about data quality trends

## Best Practices
1. Run regularly (daily or weekly)
2. Monitor quality score trends
2. Investigate critical issues immediately
3. Use larger sample sizes for comprehensive checks
4. Track quality metrics over time
5. Alert on quality score drops

---

*Part of Phase 2: Important Agents*

