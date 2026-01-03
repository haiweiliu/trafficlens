/**
 * Usage Tracking Agent
 * Generates daily usage reports and sends email
 */

import { getYesterdayUsageStats } from '../lib/usage-tracker';
import { sendUsageReportEmail } from '../lib/email';

/**
 * Generate and send daily usage report
 */
export async function generateDailyUsageReport(): Promise<void> {
  console.log('📊 Generating daily usage report...');

  const stats = getYesterdayUsageStats();

  if (!stats) {
    console.log('No usage data found for yesterday');
    return;
  }

  console.log('Usage Stats:');
  console.log(`  Total Rows: ${stats.totalRows}`);
  console.log(`  Total Errors: ${stats.totalErrors}`);
  console.log(`  Total Visits: ${stats.totalVisits.toLocaleString()}`);
  console.log(`  Cache Hits: ${stats.cacheHits}`);
  console.log(`  Cache Misses: ${stats.cacheMisses}`);

  // Send email report
  const emailSent = await sendUsageReportEmail({
    date: stats.date,
    totalRows: stats.totalRows,
    totalErrors: stats.totalErrors,
    totalVisits: stats.totalVisits,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
  });

  if (emailSent) {
    console.log('✅ Daily usage report email sent successfully');
  } else {
    console.log('⚠️ Failed to send usage report email (check email configuration)');
  }
}

/**
 * Main entry point
 */
if (require.main === module) {
  generateDailyUsageReport()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Usage agent error:', error);
      process.exit(1);
    });
}

