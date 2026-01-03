/**
 * Data Quality Agent for TrafficLens
 * Verifies data completeness, formats, relationships, and freshness
 */

interface QualityIssue {
  domain: string;
  field: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  value?: any;
  expected?: any;
}

interface QualityReport {
  timestamp: string;
  totalDomains: number;
  issues: QualityIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    qualityScore: number; // 0-100
  };
}

/**
 * Validate data completeness
 */
function validateCompleteness(data: any, domain: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const requiredFields = ['domain', 'monthlyVisits', 'checkedAt'];
  
  for (const field of requiredFields) {
    if (data[field] === null || data[field] === undefined) {
      issues.push({
        domain,
        field,
        issue: 'Missing required field',
        severity: 'critical',
      });
    }
  }
  
  return issues;
}

/**
 * Validate data formats
 */
function validateFormats(data: any, domain: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  // Validate monthly visits
  if (data.monthlyVisits !== null && data.monthlyVisits !== undefined) {
    if (typeof data.monthlyVisits !== 'number') {
      issues.push({
        domain,
        field: 'monthlyVisits',
        issue: 'Invalid type (expected number)',
        severity: 'critical',
        value: data.monthlyVisits,
      });
    } else if (data.monthlyVisits < 0) {
      issues.push({
        domain,
        field: 'monthlyVisits',
        issue: 'Negative value (impossible)',
        severity: 'critical',
        value: data.monthlyVisits,
      });
    }
  }
  
  // Validate bounce rate (0-100%)
  if (data.bounceRate !== null && data.bounceRate !== undefined) {
    if (typeof data.bounceRate !== 'number') {
      issues.push({
        domain,
        field: 'bounceRate',
        issue: 'Invalid type (expected number)',
        severity: 'critical',
        value: data.bounceRate,
      });
    } else if (data.bounceRate < 0 || data.bounceRate > 100) {
      issues.push({
        domain,
        field: 'bounceRate',
        issue: 'Out of range (0-100%)',
        severity: 'critical',
        value: data.bounceRate,
        expected: '0-100',
      });
    }
  }
  
  // Validate pages per visit (> 0)
  if (data.pagesPerVisit !== null && data.pagesPerVisit !== undefined) {
    if (typeof data.pagesPerVisit !== 'number') {
      issues.push({
        domain,
        field: 'pagesPerVisit',
        issue: 'Invalid type (expected number)',
        severity: 'critical',
        value: data.pagesPerVisit,
      });
    } else if (data.pagesPerVisit <= 0) {
      issues.push({
        domain,
        field: 'pagesPerVisit',
        issue: 'Invalid value (must be > 0)',
        severity: 'critical',
        value: data.pagesPerVisit,
      });
    }
  }
  
  // Validate duration format (HH:MM:SS)
  if (data.avgSessionDuration) {
    const durationRegex = /^\d{2}:\d{2}:\d{2}$/;
    if (!durationRegex.test(data.avgSessionDuration)) {
      issues.push({
        domain,
        field: 'avgSessionDuration',
        issue: 'Invalid format (expected HH:MM:SS)',
        severity: 'warning',
        value: data.avgSessionDuration,
        expected: 'HH:MM:SS',
      });
    }
  }
  
  // Validate domain format
  if (data.domain) {
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(data.domain)) {
      issues.push({
        domain,
        field: 'domain',
        issue: 'Invalid domain format',
        severity: 'critical',
        value: data.domain,
      });
    }
  }
  
  // Validate timestamp format
  if (data.checkedAt) {
    const date = new Date(data.checkedAt);
    if (isNaN(date.getTime())) {
      issues.push({
        domain,
        field: 'checkedAt',
        issue: 'Invalid timestamp format',
        severity: 'warning',
        value: data.checkedAt,
      });
    }
  }
  
  return issues;
}

/**
 * Validate data relationships
 */
function validateRelationships(data: any, domain: string, historicalData?: any[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  // Check if monthly visits match historical trends (if available)
  if (historicalData && historicalData.length > 0 && data.monthlyVisits !== null) {
    const recentMonths = historicalData.slice(0, 3);
    const avgVisits = recentMonths.reduce((sum, h) => sum + (h.monthly_visits || 0), 0) / recentMonths.length;
    
    // Flag if current visits are more than 10x or less than 0.1x of average
    if (data.monthlyVisits > avgVisits * 10 || data.monthlyVisits < avgVisits * 0.1) {
      issues.push({
        domain,
        field: 'monthlyVisits',
        issue: 'Significant deviation from historical average',
        severity: 'warning',
        value: data.monthlyVisits,
        expected: `~${Math.round(avgVisits)}`,
      });
    }
  }
  
  // Validate duration seconds match formatted duration
  if (data.avgSessionDuration && data.avgSessionDurationSeconds !== null) {
    const [hours, minutes, seconds] = data.avgSessionDuration.split(':').map(Number);
    const expectedSeconds = hours * 3600 + minutes * 60 + seconds;
    
    if (Math.abs(data.avgSessionDurationSeconds - expectedSeconds) > 1) {
      issues.push({
        domain,
        field: 'avgSessionDurationSeconds',
        issue: 'Mismatch with formatted duration',
        severity: 'warning',
        value: data.avgSessionDurationSeconds,
        expected: expectedSeconds,
      });
    }
  }
  
  return issues;
}

/**
 * Check for duplicates
 */
function checkDuplicates(allData: any[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const domainCounts = new Map<string, number>();
  
  for (const data of allData) {
    const normalizedDomain = data.domain.toLowerCase().replace(/^www\./, '');
    domainCounts.set(normalizedDomain, (domainCounts.get(normalizedDomain) || 0) + 1);
  }
  
  for (const [domain, count] of domainCounts.entries()) {
    if (count > 1) {
      issues.push({
        domain,
        field: 'domain',
        issue: `Duplicate entries (${count} occurrences)`,
        severity: 'warning',
        value: count,
      });
    }
  }
  
  return issues;
}

/**
 * Check data freshness
 */
function checkFreshness(data: any, domain: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  if (data.checkedAt) {
    const checkedDate = new Date(data.checkedAt);
    const now = new Date();
    const ageDays = (now.getTime() - checkedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // SimilarWeb updates monthly, so data older than 35 days might be stale
    if (ageDays > 35) {
      issues.push({
        domain,
        field: 'checkedAt',
        issue: `Data is stale (${Math.round(ageDays)} days old)`,
        severity: 'info',
        value: `${Math.round(ageDays)} days`,
      });
    }
  }
  
  return issues;
}

/**
 * Run data quality checks on database
 */
export async function runDataQualityChecks(sampleSize: number = 100): Promise<QualityReport> {
  console.log('🔍 Starting Data Quality Checks...');
  const timestamp = new Date().toISOString();
  
  try {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    
    // Get sample of latest data
    const allData = db.prepare(`
      SELECT domain, monthly_visits, avg_session_duration, 
             avg_session_duration_seconds, bounce_rate, pages_per_visit, checked_at
      FROM traffic_latest
      ORDER BY checked_at DESC
      LIMIT ?
    `).all(sampleSize) as any[];
    
    const issues: QualityIssue[] = [];
    
    for (const row of allData) {
      // Convert database row to TrafficData format
      const data = {
        domain: row.domain,
        monthlyVisits: row.monthly_visits,
        avgSessionDuration: row.avg_session_duration,
        avgSessionDurationSeconds: row.avg_session_duration_seconds,
        bounceRate: row.bounce_rate,
        pagesPerVisit: row.pages_per_visit,
        checkedAt: row.checked_at,
      };
      
      // Get historical data for relationship validation
      const historicalData = db.prepare(`
        SELECT monthly_visits
        FROM traffic_snapshots
        WHERE domain = ?
        ORDER BY month_year DESC
        LIMIT 3
      `).all(data.domain) as any[];
      
      // Run all validations
      issues.push(...validateCompleteness(data, data.domain));
      issues.push(...validateFormats(data, data.domain));
      issues.push(...validateRelationships(data, data.domain, historicalData));
      issues.push(...checkFreshness(data, data.domain));
    }
    
    // Check for duplicates
    issues.push(...checkDuplicates(allData.map(row => ({ domain: row.domain }))));
    
    const critical = issues.filter(i => i.severity === 'critical').length;
    const warning = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;
    
    // Calculate quality score (0-100)
    const totalIssues = issues.length;
    const maxIssues = allData.length * 10; // Assume max 10 issues per domain
    const qualityScore = Math.max(0, Math.round(100 - (totalIssues / maxIssues) * 100));
    
    const report: QualityReport = {
      timestamp,
      totalDomains: allData.length,
      issues,
      summary: {
        critical,
        warning,
        info,
        qualityScore,
      },
    };
    
    console.log('\n📊 Data Quality Report:');
    console.log(`Total Domains Checked: ${report.totalDomains}`);
    console.log(`Quality Score: ${qualityScore}/100`);
    console.log(`Critical Issues: ${critical}`);
    console.log(`Warnings: ${warning}`);
    console.log(`Info: ${info}`);
    
    if (critical > 0) {
      console.log('\n❌ Critical Issues:');
      issues.filter(i => i.severity === 'critical').slice(0, 10).forEach(issue => {
        console.log(`  • ${issue.domain}.${issue.field}: ${issue.issue}`);
      });
    }
    
    return report;
  } catch (error) {
    console.error('Data quality check failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runDataQualityChecks()
    .then(report => {
      process.exit(report.summary.critical > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Data quality check failed:', error);
      process.exit(1);
    });
}

