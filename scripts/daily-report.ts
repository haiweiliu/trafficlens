/**
 * Daily Report Generator
 * Sends a comprehensive daily email report including:
 * - QA test results
 * - Usage statistics
 * - Fix logs
 * - System health status
 */

import { sendUsageReportEmail, sendQAErrorEmail } from '../lib/email';
import { getYesterdayUsageStats, getUsageStatsRange } from '../lib/usage-tracker';
import { runQATests } from './qa-agent';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';

// Configuration
const EMAIL_TO = process.env.EMAIL_TO || 'mingcomco@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

interface DailyReportData {
  date: string;
  qaReport: {
    totalTests: number;
    passed: number;
    failed: number;
    autoFixed: number;
    results: Array<{
      testName: string;
      passed: boolean;
      error?: string;
      fixed?: boolean;
    }>;
  } | null;
  usageStats: {
    totalRows: number;
    totalErrors: number;
    totalVisits: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
  } | null;
  fixLogs: Array<{
    timestamp: string;
    domain: string;
    error: string;
    fixed: boolean;
    strategy?: string;
  }>;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  };
}

/**
 * Get recent QA reports from the qa-reports directory
 */
function getRecentQAReports(): any[] {
  const reportsDir = path.join(process.cwd(), 'qa-reports');
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 5); // Last 5 reports

  return files.map(f => {
    try {
      const content = fs.readFileSync(path.join(reportsDir, f), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Get recent Ralph Wiggum fix logs
 */
function getRecentFixLogs(): any[] {
  const reportsDir = path.join(process.cwd(), 'ralph-wiggum-reports');
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 3); // Last 3 reports

  const logs: any[] = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(reportsDir, f), 'utf-8');
      const report = JSON.parse(content);
      
      // Extract fix attempts
      if (report.resolvedErrors) {
        for (const err of report.resolvedErrors) {
          logs.push({
            timestamp: report.endTime,
            domain: err.domain,
            error: 'Auto-fixed',
            fixed: true,
            strategy: `Fixed on iteration ${err.fixedOn}`,
          });
        }
      }
      if (report.unresolvedErrors) {
        for (const err of report.unresolvedErrors) {
          logs.push({
            timestamp: report.endTime,
            domain: err.domain,
            error: err.error,
            fixed: false,
            strategy: `${err.fixAttempts} attempts failed`,
          });
        }
      }
    } catch {
      // Skip invalid files
    }
  }

  return logs;
}

/**
 * Determine system health status
 */
function determineSystemHealth(
  qaReport: DailyReportData['qaReport'],
  usageStats: DailyReportData['usageStats']
): DailyReportData['systemHealth'] {
  const issues: string[] = [];
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  // Check QA results
  if (qaReport) {
    if (qaReport.failed > 0) {
      if (qaReport.failed === qaReport.autoFixed) {
        issues.push(`${qaReport.failed} QA test(s) failed but were auto-fixed`);
        status = 'warning';
      } else {
        issues.push(`${qaReport.failed - qaReport.autoFixed} QA test(s) require manual attention`);
        status = 'critical';
      }
    }
  } else {
    issues.push('No QA report available');
    status = 'warning';
  }

  // Check usage stats
  if (usageStats) {
    if (usageStats.totalErrors > 0) {
      issues.push(`${usageStats.totalErrors} error(s) occurred during scraping`);
      if (status !== 'critical') status = 'warning';
    }
    if (usageStats.cacheHitRate < 50) {
      issues.push(`Low cache hit rate: ${usageStats.cacheHitRate.toFixed(1)}%`);
      if (status !== 'critical') status = 'warning';
    }
  } else {
    issues.push('No usage data available for yesterday');
  }

  if (issues.length === 0) {
    issues.push('All systems operational');
  }

  return { status, issues };
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(data: DailyReportData): string {
  const statusEmoji = data.systemHealth.status === 'healthy' ? '✅' : 
                      data.systemHealth.status === 'warning' ? '⚠️' : '🔴';
  const statusColor = data.systemHealth.status === 'healthy' ? 'green' : 
                      data.systemHealth.status === 'warning' ? 'orange' : 'red';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .content { padding: 20px; background: #f9fafb; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h3 { margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 12px; color: #666; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
    .status-healthy { background: #d4edda; color: #155724; }
    .status-warning { background: #fff3cd; color: #856404; }
    .status-critical { background: #f8d7da; color: #721c24; }
    .test-passed { color: green; }
    .test-failed { color: red; }
    .test-fixed { color: orange; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    .footer { padding: 15px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">📊 TrafficLens Daily Report</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.date}</p>
  </div>
  
  <div class="content">
    <!-- System Health -->
    <div class="section">
      <h3>${statusEmoji} System Health</h3>
      <span class="status-badge status-${data.systemHealth.status}">${data.systemHealth.status.toUpperCase()}</span>
      <ul style="margin: 15px 0 0 0;">
        ${data.systemHealth.issues.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>

    <!-- Usage Statistics -->
    ${data.usageStats ? `
    <div class="section">
      <h3>📈 Usage Statistics</h3>
      <div class="stat">
        <div class="stat-value">${data.usageStats.totalRows.toLocaleString()}</div>
        <div class="stat-label">Domains Checked</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.usageStats.totalVisits.toLocaleString()}</div>
        <div class="stat-label">Total Visits Tracked</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.usageStats.cacheHitRate.toFixed(1)}%</div>
        <div class="stat-label">Cache Hit Rate</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.usageStats.totalErrors}</div>
        <div class="stat-label">Errors</div>
      </div>
      <p style="font-size: 12px; color: #666;">
        Cache Hits: ${data.usageStats.cacheHits} | Cache Misses: ${data.usageStats.cacheMisses}
      </p>
    </div>
    ` : `
    <div class="section">
      <h3>📈 Usage Statistics</h3>
      <p style="color: #666;">No usage data available for yesterday.</p>
    </div>
    `}

    <!-- QA Test Results -->
    ${data.qaReport ? `
    <div class="section">
      <h3>🧪 QA Test Results</h3>
      <p>
        <span class="test-passed">✅ ${data.qaReport.passed} passed</span> | 
        <span class="test-failed">❌ ${data.qaReport.failed} failed</span>
        ${data.qaReport.autoFixed > 0 ? `| <span class="test-fixed">🔧 ${data.qaReport.autoFixed} auto-fixed</span>` : ''}
      </p>
      <table>
        <tr>
          <th>Test</th>
          <th>Status</th>
          <th>Details</th>
        </tr>
        ${data.qaReport.results.map(r => `
        <tr>
          <td>${r.testName}</td>
          <td>${r.passed ? '<span class="test-passed">✅ Passed</span>' : 
                r.fixed ? '<span class="test-fixed">🔧 Fixed</span>' : 
                '<span class="test-failed">❌ Failed</span>'}</td>
          <td>${r.error || '-'}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    ` : `
    <div class="section">
      <h3>🧪 QA Test Results</h3>
      <p style="color: #666;">No QA report available. Run QA tests with: npm run qa</p>
    </div>
    `}

    <!-- Fix Logs -->
    ${data.fixLogs.length > 0 ? `
    <div class="section">
      <h3>🔧 Recent Fix Attempts</h3>
      <table>
        <tr>
          <th>Domain</th>
          <th>Status</th>
          <th>Details</th>
        </tr>
        ${data.fixLogs.slice(0, 10).map(log => `
        <tr>
          <td>${log.domain}</td>
          <td>${log.fixed ? '<span class="test-passed">✅ Fixed</span>' : '<span class="test-failed">❌ Failed</span>'}</td>
          <td>${log.strategy || log.error}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <p>Generated by TrafficLens Daily Report Agent</p>
    <p><a href="https://github.com/haiweiliu/trafficlens/actions">View GitHub Actions</a> | 
       <a href="https://trafficlens.up.railway.app">Open App</a></p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(data: DailyReportData): string {
  const statusEmoji = data.systemHealth.status === 'healthy' ? '✅' : 
                      data.systemHealth.status === 'warning' ? '⚠️' : '🔴';

  let text = `
📊 TRAFFICLENS DAILY REPORT
${data.date}
${'='.repeat(50)}

${statusEmoji} SYSTEM HEALTH: ${data.systemHealth.status.toUpperCase()}
${data.systemHealth.issues.map(i => `  • ${i}`).join('\n')}

`;

  if (data.usageStats) {
    text += `
📈 USAGE STATISTICS
  • Domains Checked: ${data.usageStats.totalRows.toLocaleString()}
  • Total Visits Tracked: ${data.usageStats.totalVisits.toLocaleString()}
  • Cache Hit Rate: ${data.usageStats.cacheHitRate.toFixed(1)}%
  • Errors: ${data.usageStats.totalErrors}
  • Cache Hits: ${data.usageStats.cacheHits} | Misses: ${data.usageStats.cacheMisses}

`;
  }

  if (data.qaReport) {
    text += `
🧪 QA TEST RESULTS
  ✅ Passed: ${data.qaReport.passed}
  ❌ Failed: ${data.qaReport.failed}
  🔧 Auto-fixed: ${data.qaReport.autoFixed}

  Tests:
${data.qaReport.results.map(r => `    ${r.passed ? '✅' : r.fixed ? '🔧' : '❌'} ${r.testName}${r.error ? `: ${r.error}` : ''}`).join('\n')}

`;
  }

  if (data.fixLogs.length > 0) {
    text += `
🔧 RECENT FIX ATTEMPTS
${data.fixLogs.slice(0, 10).map(log => `  ${log.fixed ? '✅' : '❌'} ${log.domain}: ${log.strategy || log.error}`).join('\n')}

`;
  }

  text += `
${'='.repeat(50)}
Generated by TrafficLens Daily Report Agent
https://github.com/haiweiliu/trafficlens/actions
  `;

  return text;
}

/**
 * Send comprehensive daily report email
 */
async function sendDailyReportEmail(data: DailyReportData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.log('❌ RESEND_API_KEY not configured. Email not sent.');
    console.log('   To enable email reports:');
    console.log('   1. Get API key from https://resend.com');
    console.log('   2. Set RESEND_API_KEY environment variable');
    return false;
  }

  const resend = new Resend(apiKey);
  const statusEmoji = data.systemHealth.status === 'healthy' ? '✅' : 
                      data.systemHealth.status === 'warning' ? '⚠️' : '🔴';

  try {
    const { data: emailResult, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `${statusEmoji} TrafficLens Daily Report - ${data.date}`,
      html: generateEmailHTML(data),
      text: generateEmailText(data),
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      if (error.message?.includes('only send testing emails')) {
        console.error('   💡 Free tier only allows sending to your Resend account email.');
        console.error('   To send to mingcomco@gmail.com, verify a domain at resend.com/domains');
      }
      return false;
    }

    console.log(`✅ Daily report email sent successfully to ${EMAIL_TO}`);
    console.log(`   Email ID: ${emailResult?.id}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send daily report email:', error);
    return false;
  }
}

/**
 * Generate and send the daily report
 */
export async function generateDailyReport(): Promise<void> {
  console.log('📊 Generating Daily Report...\n');
  
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Get yesterday's usage stats
  const usageStats = getYesterdayUsageStats();
  let formattedUsageStats: DailyReportData['usageStats'] = null;
  
  if (usageStats) {
    const total = usageStats.cacheHits + usageStats.cacheMisses;
    formattedUsageStats = {
      ...usageStats,
      cacheHitRate: total > 0 ? (usageStats.cacheHits / total) * 100 : 0,
    };
    console.log('📈 Usage Stats:', formattedUsageStats);
  } else {
    console.log('📈 No usage stats available for yesterday');
  }

  // Get recent QA reports
  const qaReports = getRecentQAReports();
  let qaReport: DailyReportData['qaReport'] = null;
  
  if (qaReports.length > 0) {
    const latest = qaReports[0];
    qaReport = {
      totalTests: latest.totalTests || 0,
      passed: latest.passed || 0,
      failed: latest.failed || 0,
      autoFixed: latest.fixed || 0,
      results: (latest.results || []).map((r: any) => ({
        testName: r.testName,
        passed: r.passed,
        error: r.error,
        fixed: r.fixed,
      })),
    };
    console.log('🧪 QA Report:', qaReport);
  } else {
    console.log('🧪 No QA reports found');
  }

  // Get recent fix logs
  const fixLogs = getRecentFixLogs();
  console.log(`🔧 Fix Logs: ${fixLogs.length} entries`);

  // Determine system health
  const systemHealth = determineSystemHealth(qaReport, formattedUsageStats);
  console.log(`\n${systemHealth.status === 'healthy' ? '✅' : systemHealth.status === 'warning' ? '⚠️' : '🔴'} System Health: ${systemHealth.status.toUpperCase()}`);
  systemHealth.issues.forEach(i => console.log(`   • ${i}`));

  // Compile report data
  const reportData: DailyReportData = {
    date: today,
    qaReport,
    usageStats: formattedUsageStats,
    fixLogs,
    systemHealth,
  };

  // Send email
  console.log('\n📧 Sending daily report email...');
  const emailSent = await sendDailyReportEmail(reportData);

  if (!emailSent) {
    console.log('\n⚠️ Email not sent. Report summary:');
    console.log(generateEmailText(reportData));
  }

  // Save report to file
  const reportsDir = path.join(process.cwd(), 'daily-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportFile = path.join(reportsDir, `daily-report-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Report saved to: ${reportFile}`);
}

// Entry point
if (require.main === module) {
  generateDailyReport()
    .then(() => {
      console.log('\n✅ Daily report generation complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Daily report error:', error);
      process.exit(1);
    });
}
