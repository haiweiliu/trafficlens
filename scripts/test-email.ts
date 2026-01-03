/**
 * Test email sending functionality
 */

import { sendQAErrorEmail, sendUsageReportEmail } from '../lib/email';

async function testEmails() {
  console.log('📧 Testing email functionality...\n');

  // Test 1: QA Error Email
  console.log('Test 1: QA Error Email');
  const qaReport = {
    timestamp: new Date().toISOString(),
    failed: 2,
    totalTests: 5,
    results: [
      { testName: 'Basic Scraping', passed: true },
      { testName: 'Data Extraction', passed: false, error: 'Test error message' },
      { testName: 'Cache Functionality', passed: true },
      { testName: 'Order Preservation', passed: false, error: 'Another test error' },
      { testName: 'Error Handling', passed: true },
    ],
  };

  const qaSent = await sendQAErrorEmail(qaReport);
  console.log(`QA Error Email: ${qaSent ? '✅ Sent' : '❌ Failed'}\n`);

  // Test 2: Usage Report Email
  console.log('Test 2: Usage Report Email');
  const usageStats = {
    date: new Date().toISOString().split('T')[0],
    totalRows: 150,
    totalErrors: 5,
    totalVisits: 50000000,
    cacheHits: 100,
    cacheMisses: 50,
  };

  const usageSent = await sendUsageReportEmail(usageStats);
  console.log(`Usage Report Email: ${usageSent ? '✅ Sent' : '❌ Failed'}\n`);

  if (!qaSent && !usageSent) {
    console.log('⚠️  Email not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.');
    console.log('See EMAIL_SETUP.md for instructions.');
  }
}

if (require.main === module) {
  testEmails()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

