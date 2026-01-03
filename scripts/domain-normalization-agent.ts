/**
 * Domain Normalization Agent for TrafficLens
 * Comprehensive domain testing and edge case handling
 */

import { normalizeDomain } from '../lib/domain-utils';

interface DomainTest {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

interface DomainTestReport {
  timestamp: string;
  tests: DomainTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  edgeCases: string[];
}

/**
 * Test cases for domain normalization
 */
const DOMAIN_TEST_CASES = [
  // Basic cases
  { input: 'example.com', expected: 'example.com' },
  { input: 'www.example.com', expected: 'example.com' },
  { input: 'http://example.com', expected: 'example.com' },
  { input: 'https://example.com', expected: 'example.com' },
  { input: 'https://www.example.com', expected: 'example.com' },
  { input: 'http://www.example.com', expected: 'example.com' },
  
  // Paths and query strings
  { input: 'example.com/path', expected: 'example.com' },
  { input: 'example.com/path/to/page', expected: 'example.com' },
  { input: 'example.com?query=value', expected: 'example.com' },
  { input: 'example.com/path?query=value', expected: 'example.com' },
  { input: 'https://www.example.com/path?query=value', expected: 'example.com' },
  
  // Trailing slashes and dots
  { input: 'example.com/', expected: 'example.com' },
  { input: 'example.com.', expected: 'example.com' },
  { input: 'www.example.com.', expected: 'example.com' },
  
  // Subdomains
  { input: 'subdomain.example.com', expected: 'subdomain.example.com' },
  { input: 'www.subdomain.example.com', expected: 'subdomain.example.com' },
  { input: 'https://subdomain.example.com', expected: 'subdomain.example.com' },
  
  // Complex TLDs
  { input: 'example.co.uk', expected: 'example.co.uk' },
  { input: 'www.example.co.uk', expected: 'example.co.uk' },
  { input: 'example.com.au', expected: 'example.com.au' },
  
  // Edge cases
  { input: 'EXAMPLE.COM', expected: 'example.com' }, // Lowercase
  { input: 'Example.Com', expected: 'example.com' }, // Mixed case
  { input: '  example.com  ', expected: 'example.com' }, // Whitespace
  { input: 'example.com:80', expected: 'example.com' }, // Port
  { input: 'example.com:443', expected: 'example.com' }, // Port
];

/**
 * Edge case domains to test
 */
const EDGE_CASE_DOMAINS = [
  'xn--n3h.com', // Punycode
  'test.co.uk',
  'sub.subdomain.example.com',
  'a.b.c.d.example.com',
  'very-long-domain-name-that-should-still-work.example.com',
  '123example.com',
  'example123.com',
  'example-123.com',
];

/**
 * Run domain normalization tests
 */
function runNormalizationTests(): DomainTest[] {
  const tests: DomainTest[] = [];
  
  for (const testCase of DOMAIN_TEST_CASES) {
    try {
      const actual = normalizeDomain(testCase.input);
      const passed = actual === testCase.expected;
      
      tests.push({
        input: testCase.input,
        expected: testCase.expected,
        actual,
        passed,
        error: passed ? undefined : `Expected "${testCase.expected}", got "${actual}"`,
      });
    } catch (error) {
      tests.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: 'ERROR',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return tests;
}

/**
 * Test edge cases
 */
function testEdgeCases(): string[] {
  const issues: string[] = [];
  
  for (const domain of EDGE_CASE_DOMAINS) {
    try {
      const normalized = normalizeDomain(domain);
      
      // Basic validation
      if (!normalized || normalized.length === 0) {
        issues.push(`${domain}: Normalization returned empty string`);
        continue;
      }
      
      // Should not contain protocols
      if (normalized.includes('://')) {
        issues.push(`${domain}: Normalized domain contains protocol`);
        continue;
      }
      
      // Should not contain paths
      if (normalized.includes('/')) {
        issues.push(`${domain}: Normalized domain contains path`);
        continue;
      }
      
      // Should not contain query strings
      if (normalized.includes('?')) {
        issues.push(`${domain}: Normalized domain contains query string`);
        continue;
      }
      
      // Should be lowercase
      if (normalized !== normalized.toLowerCase()) {
        issues.push(`${domain}: Normalized domain is not lowercase`);
        continue;
      }
      
    } catch (error) {
      issues.push(`${domain}: Error during normalization - ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  return issues;
}

/**
 * Test domain matching (www. variations)
 */
function testDomainMatching(): DomainTest[] {
  const tests: DomainTest[] = [];
  const testPairs = [
    ['example.com', 'www.example.com'],
    ['www.example.com', 'example.com'],
    ['subdomain.example.com', 'www.subdomain.example.com'],
    ['test.co.uk', 'www.test.co.uk'],
  ];
  
  for (const [domain1, domain2] of testPairs) {
    try {
      const norm1 = normalizeDomain(domain1);
      const norm2 = normalizeDomain(domain2);
      const passed = norm1 === norm2;
      
      tests.push({
        input: `${domain1} vs ${domain2}`,
        expected: 'Match',
        actual: passed ? 'Match' : 'No match',
        passed,
        error: passed ? undefined : `"${norm1}" !== "${norm2}"`,
      });
    } catch (error) {
      tests.push({
        input: `${domain1} vs ${domain2}`,
        expected: 'Match',
        actual: 'ERROR',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return tests;
}

/**
 * Generate domain normalization report
 */
export async function runDomainNormalizationTests(): Promise<DomainTestReport> {
  console.log('🔍 Starting Domain Normalization Tests...');
  const timestamp = new Date().toISOString();
  
  const normalizationTests = runNormalizationTests();
  const matchingTests = testDomainMatching();
  const tests = [...normalizationTests, ...matchingTests];
  const edgeCases = testEdgeCases();
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  const report: DomainTestReport = {
    timestamp,
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
    },
    edgeCases,
  };
  
  console.log('\n📊 Domain Normalization Report:');
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Edge Case Issues: ${edgeCases.length}`);
  
  // Show failed tests
  const failedTests = tests.filter(t => !t.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const test of failedTests.slice(0, 10)) {
      console.log(`  • ${test.input}`);
      console.log(`    Expected: ${test.expected}, Got: ${test.actual}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    }
  }
  
  // Show edge case issues
  if (edgeCases.length > 0) {
    console.log('\n⚠️  Edge Case Issues:');
    for (const issue of edgeCases.slice(0, 10)) {
      console.log(`  • ${issue}`);
    }
  }
  
  return report;
}

// Run if executed directly
if (require.main === module) {
  runDomainNormalizationTests()
    .then(report => {
      process.exit(report.summary.failed > 0 || report.edgeCases.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Domain normalization test failed:', error);
      process.exit(1);
    });
}

