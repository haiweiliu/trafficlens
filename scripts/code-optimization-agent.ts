/**
 * Code Optimization Agent
 * Analyzes code for performance issues and suggests optimizations
 */

import * as fs from 'fs';
import * as path from 'path';
import { sendCodeOptimizationEmail } from '../lib/email';

interface OptimizationIssue {
  file: string;
  type: 'performance' | 'bundle-size' | 'memory' | 'api' | 'database';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  line?: number;
}

interface OptimizationReport {
  timestamp: string;
  totalIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  issues: OptimizationIssue[];
}

/**
 * Analyze API routes for performance issues
 */
function analyzeAPIRoutes(): OptimizationIssue[] {
  const issues: OptimizationIssue[] = [];
  const apiDir = path.join(process.cwd(), 'app/api');

  if (!fs.existsSync(apiDir)) {
    return issues;
  }

  const routeFiles = fs.readdirSync(apiDir, { recursive: true })
    .filter((file): file is string => typeof file === 'string' && file.endsWith('route.ts'));

  for (const file of routeFiles) {
    const filePath = path.join(apiDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check for missing maxDuration
    if (content.includes('export async function') && !content.includes('maxDuration')) {
      issues.push({
        file: `app/api/${file}`,
        type: 'api',
        severity: 'medium',
        description: 'API route missing maxDuration configuration',
        suggestion: 'Add `export const maxDuration = 300;` for long-running routes',
      });
    }

    // Check for blocking operations
    lines.forEach((line, index) => {
      if (line.includes('await') && (
        line.includes('sleep(') ||
        line.includes('setTimeout') ||
        line.includes('for (') ||
        line.includes('while (')
      )) {
        issues.push({
          file: `app/api/${file}`,
          type: 'performance',
          severity: 'low',
          description: 'Potential blocking operation detected',
          suggestion: 'Consider using background jobs or parallel processing',
          line: index + 1,
        });
      }
    });

    // Check for large data processing
    if (content.includes('.map(') && content.includes('.filter(') && content.includes('.reduce(')) {
      const mapCount = (content.match(/\.map\(/g) || []).length;
      if (mapCount > 5) {
        issues.push({
          file: `app/api/${file}`,
          type: 'performance',
          severity: 'medium',
          description: 'Multiple array operations detected (potential N+1 issue)',
          suggestion: 'Consider batching operations or using database aggregations',
        });
      }
    }
  }

  return issues;
}

/**
 * Analyze components for bundle size issues
 */
function analyzeComponents(): OptimizationIssue[] {
  const issues: OptimizationIssue[] = [];
  const componentsDir = path.join(process.cwd(), 'components');

  if (!fs.existsSync(componentsDir)) {
    return issues;
  }

  const componentFiles = fs.readdirSync(componentsDir)
    .filter((file: string) => file.endsWith('.tsx') || file.endsWith('.ts'));

  for (const file of componentFiles) {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    // Check for large components
    if (fileSize > 10000) { // 10KB
      issues.push({
        file: `components/${file}`,
        type: 'bundle-size',
        severity: 'medium',
        description: `Large component file (${(fileSize / 1024).toFixed(1)}KB)`,
        suggestion: 'Consider splitting into smaller components or using dynamic imports',
      });
    }

    // Check for missing React.memo
    if (content.includes('export default function') && 
        !content.includes('React.memo') &&
        content.includes('props')) {
      issues.push({
        file: `components/${file}`,
        type: 'performance',
        severity: 'low',
        description: 'Component could benefit from React.memo',
        suggestion: 'Wrap component with React.memo to prevent unnecessary re-renders',
      });
    }

    // Check for inline functions in JSX
    const inlineFunctionMatches = content.match(/onClick=\{.*=>/g);
    if (inlineFunctionMatches && inlineFunctionMatches.length > 5) {
      issues.push({
        file: `components/${file}`,
        type: 'performance',
        severity: 'low',
        description: 'Multiple inline functions detected',
        suggestion: 'Extract inline functions to useCallback or component methods',
      });
    }
  }

  return issues;
}

/**
 * Analyze database queries
 */
function analyzeDatabase(): OptimizationIssue[] {
  const issues: OptimizationIssue[] = [];
  const dbFile = path.join(process.cwd(), 'lib/db.ts');

  if (!fs.existsSync(dbFile)) {
    return issues;
  }

  const content = fs.readFileSync(dbFile, 'utf-8');
  const lines = content.split('\n');

  // Check for N+1 query patterns
  lines.forEach((line, index) => {
    if (line.includes('for (') && (
      line.includes('db.prepare') ||
      line.includes('db.query') ||
      line.includes('getLatestTrafficData')
    )) {
      issues.push({
        file: 'lib/db.ts',
        type: 'database',
        severity: 'high',
        description: 'Potential N+1 query pattern detected',
        suggestion: 'Use batch queries or database joins instead of loops',
        line: index + 1,
      });
    }
  });

  // Check for missing indexes
  if (content.includes('CREATE TABLE') && !content.includes('CREATE INDEX')) {
    issues.push({
      file: 'lib/db.ts',
      type: 'database',
      severity: 'medium',
      description: 'No indexes defined in schema',
      suggestion: 'Add indexes on frequently queried columns (domain, checked_at, etc.)',
    });
  }

  return issues;
}

/**
 * Analyze scraper for performance issues
 */
function analyzeScraper(): OptimizationIssue[] {
  const issues: OptimizationIssue[] = [];
  const scraperFile = path.join(process.cwd(), 'lib/scraper.ts');

  if (!fs.existsSync(scraperFile)) {
    return issues;
  }

  const content = fs.readFileSync(scraperFile, 'utf-8');
  const lines = content.split('\n');

  // Check for sequential awaits
  let sequentialAwaits = 0;
  lines.forEach((line, index) => {
    if (line.includes('await') && !line.includes('Promise.all')) {
      sequentialAwaits++;
    } else {
      if (sequentialAwaits > 3) {
        issues.push({
          file: 'lib/scraper.ts',
          type: 'performance',
          severity: 'medium',
          description: 'Multiple sequential awaits detected',
          suggestion: 'Consider using Promise.all for parallel operations',
          line: index + 1,
        });
      }
      sequentialAwaits = 0;
    }
  });

  // Check for memory leaks (missing browser.close)
  if (content.includes('chromium.launch') && !content.includes('browser.close()')) {
    issues.push({
      file: 'lib/scraper.ts',
      type: 'memory',
      severity: 'high',
      description: 'Browser instances may not be closed properly',
      suggestion: 'Ensure all browser instances are closed in finally blocks',
    });
  }

  return issues;
}

/**
 * Generate optimization report
 */
export async function generateOptimizationReport(): Promise<OptimizationReport> {
  console.log('🔍 Analyzing code for optimization opportunities...\n');

  const issues: OptimizationIssue[] = [
    ...analyzeAPIRoutes(),
    ...analyzeComponents(),
    ...analyzeDatabase(),
    ...analyzeScraper(),
  ];

  // Group by type and severity
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });

  const report: OptimizationReport = {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    byType,
    bySeverity,
    issues,
  };

  // Log summary
  console.log(`📊 Optimization Report Summary:`);
  console.log(`   Total Issues: ${report.totalIssues}`);
  console.log(`   By Type: ${JSON.stringify(byType)}`);
  console.log(`   By Severity: ${JSON.stringify(bySeverity)}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues Found:`);
    issues.forEach(issue => {
      console.log(`   [${issue.severity.toUpperCase()}] ${issue.file}: ${issue.description}`);
    });
  } else {
    console.log('\n✅ No optimization issues found!');
  }

  return report;
}

/**
 * Main entry point
 */
if (require.main === module) {
  generateOptimizationReport()
    .then(async (report) => {
      // Send email if there are high-severity issues
      const highSeverityIssues = report.issues.filter(i => i.severity === 'high');
      if (highSeverityIssues.length > 0) {
        console.log(`\n📧 Sending optimization report email (${highSeverityIssues.length} high-severity issues)...`);
        await sendCodeOptimizationEmail(report);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Code optimization agent error:', error);
      process.exit(1);
    });
}

