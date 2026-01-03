/**
 * Test email sending functionality
 */

import { sendQAErrorEmail, sendUsageReportEmail } from '../lib/email';

async function testEmails() {
  console.log('📧 Testing email functionality with Resend...\n');

  // Check if API key is set
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️  RESEND_API_KEY not set. Setting from command line argument or using default...');
    // Allow passing API key as argument: npm run test:email -- re_xxxxx
    const apiKey = process.argv[2];
    if (apiKey && apiKey.startsWith('re_')) {
      process.env.RESEND_API_KEY = apiKey;
      console.log('✅ Using API key from command line argument\n');
    } else {
      console.log('❌ Please set RESEND_API_KEY environment variable or pass as argument:');
      console.log('   npm run test:email -- re_xxxxx');
      console.log('   or');
      console.log('   export RESEND_API_KEY=re_xxxxx && npm run test:email\n');
      return;
    }
  }

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

  if (qaSent && usageSent) {
    console.log('🎉 All test emails sent successfully!');
    console.log('Check your inbox at mingcomco@gmail.com');
  } else {
    console.log('⚠️  Some emails failed. Check the error messages above.');
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

