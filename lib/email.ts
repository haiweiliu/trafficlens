/**
 * Email notification service for QA and usage reports
 * Uses Resend API (no password needed - API key only)
 */

import { Resend } from 'resend';

// Resend free tier: Can only send to account email unless domain is verified
// To send to other emails, verify a domain at resend.com/domains
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
}

export async function sendQAErrorEmail(report: {
  timestamp: string;
  failed: number;
  totalTests: number;
  results: QATestResult[];
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
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

