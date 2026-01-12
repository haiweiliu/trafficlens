/**
 * Email notification service for QA and usage reports
 * Uses Resend API (no password needed - API key only)
 */

import { Resend } from 'resend';

// Resend configuration
// Default recipient: mingcomco@gmail.com
const EMAIL_TO = process.env.EMAIL_TO || 'mingcomco@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Resend default, can be changed to your domain

// Initialize Resend client
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured. Email notifications disabled.');
    return null;
  }

  return new Resend(apiKey);
}

/**
 * Send QA error notification email
 */
interface QATestResult {
  testName: string;
  passed?: boolean;
  error?: string;
  fixed?: boolean;
  details?: {
    deepFixAttempted?: boolean;
    deepFixAttempts?: Array<{ strategy: string; success: boolean; details: string }>;
    needsManualIntervention?: boolean;
  };
}

export async function sendQAErrorEmail(report: {
  timestamp: string;
  failed: number;
  totalTests: number;
  results: QATestResult[];
  autoFixed?: number;
  needsManualFix?: number;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('Email not configured - skipping QA error email');
    return false;
  }

  try {
    const failedTests = report.results.filter(r => !r.passed);
    const autoFixed = report.autoFixed || 0;
    const needsManualFix = report.needsManualFix || report.failed;
    
    const errorList = failedTests
      .map(test => {
        const status = test.fixed 
          ? ' ✅ (Auto-fixed)' 
          : (test.details?.needsManualIntervention 
            ? ' 🔴 (Deep fix failed - Manual intervention required)' 
            : ' ⚠️ (Needs manual fix)');
        const deepFixInfo = test.details?.deepFixAttempted 
          ? `\n    Deep fix attempts: ${test.details.deepFixAttempts?.map((a: any) => `\n      - ${a.strategy}: ${a.success ? '✅' : '❌'} ${a.details}`).join('')}` 
          : '';
        return `• ${test.testName}: ${test.error || 'Unknown error'}${status}${deepFixInfo}`;
      })
      .join('\n\n');

    const html = `
      <h2>⚠️ TrafficLens QA Tests Failed</h2>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Status:</strong> ${report.failed} out of ${report.totalTests} tests failed</p>
      
      ${autoFixed > 0 ? `<p style="color: green; font-weight: bold;">✅ ${autoFixed} error(s) were auto-fixed by QA Agent</p>` : ''}
      ${needsManualFix > 0 ? `<p style="color: red; font-weight: bold;">⚠️ ${needsManualFix} error(s) require manual attention</p>` : ''}
      
      <h3>Failed Tests:</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${errorList}</pre>
      
      ${needsManualFix > 0 ? `<p><strong>Action Required:</strong> Please review and fix the errors marked with ⚠️</p>` : ''}
      <p>Please check the QA reports and logs for more details.</p>
      <p><a href="https://github.com/haiweiliu/trafficlens/actions">View GitHub Actions</a></p>
    `;

    const text = `
TrafficLens QA Tests Failed

Date: ${new Date(report.timestamp).toLocaleString()}
Status: ${report.failed} out of ${report.totalTests} tests failed

Failed Tests:
${errorList}

Please check the QA reports and logs for more details.
    `;

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `⚠️ TrafficLens QA: ${report.failed} Test(s) Failed`,
      text,
      html,
    });

    if (error) {
      console.error('Resend API error:', error);
      // If error is about recipient restriction, provide helpful message
      if (error.message?.includes('only send testing emails to your own email')) {
        console.error('💡 Tip: Resend free tier only allows sending to your account email.');
        console.error('   To send to other emails, verify a domain at resend.com/domains');
      }
      return false;
    }

    console.log('QA error email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send QA error email:', error);
    return false;
  }
}

/**
 * Send daily usage report email
 */
export async function sendUsageReportEmail(stats: {
  date: string;
  totalRows: number;
  totalErrors: number;
  totalVisits: number;
  cacheHits: number;
  cacheMisses: number;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('Email not configured - skipping usage report email');
    return false;
  }

  try {
    const html = `
      <h2>📊 TrafficLens Daily Usage Report</h2>
      <p><strong>Date:</strong> ${stats.date}</p>
      
      <ul style="font-size: 16px; line-height: 2;">
        <li><strong>Total Row Research:</strong> ${stats.totalRows}</li>
        <li><strong>Total Errors:</strong> ${stats.totalErrors}</li>
        <li><strong>Total Visits (Sum):</strong> ${stats.totalVisits.toLocaleString()}</li>
        <li><strong>Cache Hits:</strong> ${stats.cacheHits}</li>
        <li><strong>Cache Misses:</strong> ${stats.cacheMisses}</li>
      </ul>
      
      <p style="margin-top: 20px; color: #666;">
        Generated automatically by TrafficLens Usage Tracker
      </p>
    `;

    const text = `
TrafficLens Daily Usage Report

Date: ${stats.date}

• Total Row Research: ${stats.totalRows}
• Total Errors: ${stats.totalErrors}
• Total Visits (Sum): ${stats.totalVisits.toLocaleString()}
• Cache Hits: ${stats.cacheHits}
• Cache Misses: ${stats.cacheMisses}

Generated automatically by TrafficLens Usage Tracker
    `;

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `📊 TrafficLens Daily Usage Report - ${stats.date}`,
      text,
      html,
    });

    if (error) {
      console.error('Resend API error:', error);
      // If error is about recipient restriction, provide helpful message
      if (error.message?.includes('only send testing emails to your own email')) {
        console.error('💡 Tip: Resend free tier only allows sending to your account email.');
        console.error('   To send to other emails, verify a domain at resend.com/domains');
      }
      return false;
    }

    console.log('Usage report email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send usage report email:', error);
    return false;
  }
}

/**
 * Send code optimization report email
 */
export async function sendCodeOptimizationEmail(report: {
  timestamp: string;
  totalIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  issues: Array<{
    file: string;
    type: string;
    severity: string;
    description: string;
    suggestion: string;
    line?: number;
  }>;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('Email not configured - skipping code optimization email');
    return false;
  }

  try {
    const highSeverityIssues = report.issues.filter(i => i.severity === 'high');
    const issueList = report.issues
      .map(issue => `• [${issue.severity.toUpperCase()}] ${issue.file}${issue.line ? `:${issue.line}` : ''}: ${issue.description}`)
      .join('\n');

    const html = `
      <h2>🔧 TrafficLens Code Optimization Report</h2>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Total Issues:</strong> ${report.totalIssues}</p>
      
      <h3>Issues by Type:</h3>
      <ul>
        ${Object.entries(report.byType).map(([type, count]) => `<li><strong>${type}:</strong> ${count}</li>`).join('')}
      </ul>
      
      <h3>Issues by Severity:</h3>
      <ul>
        ${Object.entries(report.bySeverity).map(([severity, count]) => `<li><strong>${severity}:</strong> ${count}</li>`).join('')}
      </ul>
      
      <h3>All Issues:</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; max-height: 500px; overflow-y: auto;">${issueList}</pre>
      
      ${highSeverityIssues.length > 0 ? `<p style="color: red; font-weight: bold;">⚠️ ${highSeverityIssues.length} high-severity issue(s) require attention!</p>` : ''}
    `;

    const text = `
TrafficLens Code Optimization Report

Date: ${new Date(report.timestamp).toLocaleString()}
Total Issues: ${report.totalIssues}

Issues by Type:
${Object.entries(report.byType).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

Issues by Severity:
${Object.entries(report.bySeverity).map(([severity, count]) => `  ${severity}: ${count}`).join('\n')}

All Issues:
${issueList}
    `;

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `🔧 TrafficLens Code Optimization: ${report.totalIssues} Issue(s) Found`,
      text,
      html,
    });

    if (error) {
      console.error('Resend API error:', error);
      return false;
    }

    console.log('Code optimization email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send code optimization email:', error);
    return false;
  }
}

/**
 * Send page load optimization report email
 */
export async function sendPageLoadOptimizationEmail(report: {
  timestamp: string;
  totalIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  issues: Array<{
    page: string;
    type: string;
    severity: string;
    description: string;
    suggestion: string;
  }>;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('Email not configured - skipping page load optimization email');
    return false;
  }

  try {
    const highSeverityIssues = report.issues.filter(i => i.severity === 'high');
    const issueList = report.issues
      .map(issue => `• [${issue.severity.toUpperCase()}] ${issue.page}: ${issue.description}\n  → ${issue.suggestion}`)
      .join('\n\n');

    const html = `
      <h2>⚡ TrafficLens Page Load Optimization Report</h2>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Total Issues:</strong> ${report.totalIssues}</p>
      
      <h3>Issues by Type:</h3>
      <ul>
        ${Object.entries(report.byType).map(([type, count]) => `<li><strong>${type}:</strong> ${count}</li>`).join('')}
      </ul>
      
      <h3>Issues by Severity:</h3>
      <ul>
        ${Object.entries(report.bySeverity).map(([severity, count]) => `<li><strong>${severity}:</strong> ${count}</li>`).join('')}
      </ul>
      
      <h3>All Issues:</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; max-height: 500px; overflow-y: auto; white-space: pre-wrap;">${issueList}</pre>
      
      ${highSeverityIssues.length > 0 ? `<p style="color: red; font-weight: bold;">⚠️ ${highSeverityIssues.length} high-severity issue(s) require attention!</p>` : ''}
    `;

    const text = `
TrafficLens Page Load Optimization Report

Date: ${new Date(report.timestamp).toLocaleString()}
Total Issues: ${report.totalIssues}

Issues by Type:
${Object.entries(report.byType).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

Issues by Severity:
${Object.entries(report.bySeverity).map(([severity, count]) => `  ${severity}: ${count}`).join('\n')}

All Issues:
${issueList}
    `;

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `⚡ TrafficLens Page Load Optimization: ${report.totalIssues} Issue(s) Found`,
      text,
      html,
    });

    if (error) {
      console.error('Resend API error:', error);
      return false;
    }

    console.log('Page load optimization email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Failed to send page load optimization email:', error);
    return false;
  }
}
