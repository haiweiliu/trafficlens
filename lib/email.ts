/**
 * Email notification service for QA and usage reports
 */

import * as nodemailer from 'nodemailer';

const EMAIL_TO = 'mingcomco@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@trafficlens.com';

// Configure email transporter
// For production, use SMTP service (Gmail, SendGrid, etc.)
// For now, using Gmail SMTP (requires app password)
function getTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPassword) {
    console.warn('Email credentials not configured. Email notifications disabled.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPassword, // Use App Password, not regular password
    },
  });
}

/**
 * Send QA error notification email
 */
interface QATestResult {
  testName: string;
  passed?: boolean;
  error?: string;
  fixed?: boolean;
}

export async function sendQAErrorEmail(report: {
  timestamp: string;
  failed: number;
  totalTests: number;
  results: QATestResult[];
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email not configured - skipping QA error email');
    return false;
  }

  try {
    const failedTests = report.results.filter(r => !r.passed);
    const errorList = failedTests
      .map(test => `• ${test.testName}: ${test.error || 'Unknown error'}${test.fixed ? ' (Auto-fixed)' : ''}`)
      .join('\n');

    const html = `
      <h2>⚠️ TrafficLens QA Tests Failed</h2>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Status:</strong> ${report.failed} out of ${report.totalTests} tests failed</p>
      
      <h3>Failed Tests:</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${errorList}</pre>
      
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

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `⚠️ TrafficLens QA: ${report.failed} Test(s) Failed`,
      text,
      html,
    });

    console.log('QA error email sent successfully');
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
  const transporter = getTransporter();
  if (!transporter) {
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

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `📊 TrafficLens Daily Usage Report - ${stats.date}`,
      text,
      html,
    });

    console.log('Usage report email sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send usage report email:', error);
    return false;
  }
}

