/**
 * Page Load Optimization Agent
 * Analyzes page load performance and suggests optimizations
 */

import * as fs from 'fs';
import * as path from 'path';
import { sendPageLoadOptimizationEmail } from '../lib/email';

interface PageLoadIssue {
  page: string;
  type: 'image' | 'font' | 'script' | 'css' | 'api' | 'bundle' | 'hydration';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  currentValue?: string;
  targetValue?: string;
}

interface PageLoadReport {
  timestamp: string;
  totalIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  issues: PageLoadIssue[];
}

/**
 * Analyze Next.js pages for optimization opportunities
 */
function analyzePages(): PageLoadIssue[] {
  const issues: PageLoadIssue[] = [];
  const pagesDir = path.join(process.cwd(), 'app');

  if (!fs.existsSync(pagesDir)) {
    return issues;
  }

  const pageFiles = fs.readdirSync(pagesDir, { recursive: true })
    .filter((file: string) => file.endsWith('page.tsx') || file.endsWith('page.ts'));

  for (const file of pageFiles) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for 'use client' without proper optimization
    if (content.includes("'use client'")) {
      // Check for large client components
      const fileSize = fs.statSync(filePath).size;
      if (fileSize > 5000) {
        issues.push({
          page: `app/${file}`,
          type: 'bundle',
          severity: 'medium',
          description: `Large client component (${(fileSize / 1024).toFixed(1)}KB)`,
          suggestion: 'Consider splitting into smaller components or using server components where possible',
        });
      }

      // Check for missing Suspense boundaries
      if (content.includes('useState') && !content.includes('Suspense')) {
        issues.push({
          page: `app/${file}`,
          type: 'hydration',
          severity: 'low',
          description: 'Client component with state but no Suspense boundary',
          suggestion: 'Add Suspense boundaries for better loading states',
        });
      }
    }

    // Check for missing dynamic imports
    if (content.includes('import') && content.includes('from') && !content.includes('dynamic')) {
      const importCount = (content.match(/^import /gm) || []).length;
      if (importCount > 5) {
        issues.push({
          page: `app/${file}`,
          type: 'bundle',
          severity: 'medium',
          description: `Many static imports (${importCount})`,
          suggestion: 'Consider using dynamic imports for heavy dependencies',
        });
      }
    }

    // Check for missing image optimization
    if (content.includes('<img') && !content.includes('next/image')) {
      issues.push({
        page: `app/${file}`,
        type: 'image',
        severity: 'high',
        description: 'Using <img> instead of next/image',
        suggestion: 'Replace <img> tags with next/image for automatic optimization',
      });
    }

    // Check for missing font optimization
    if (content.includes('font-family') && !content.includes('next/font')) {
      issues.push({
        page: `app/${file}`,
        type: 'font',
        severity: 'low',
        description: 'Using CSS font-family instead of next/font',
        suggestion: 'Use next/font for automatic font optimization',
      });
    }
  }

  return issues;
}

/**
 * Analyze API routes for performance
 */
function analyzeAPIPerformance(): PageLoadIssue[] {
  const issues: PageLoadIssue[] = [];
  const apiDir = path.join(process.cwd(), 'app/api');

  if (!fs.existsSync(apiDir)) {
    return issues;
  }

  const routeFiles = fs.readdirSync(apiDir, { recursive: true })
    .filter((file: string) => file.endsWith('route.ts'));

  for (const file of routeFiles) {
    const filePath = path.join(apiDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for missing caching headers
    if (content.includes('NextResponse.json') && !content.includes('Cache-Control')) {
      issues.push({
        page: `app/api/${file}`,
        type: 'api',
        severity: 'medium',
        description: 'API route missing cache headers',
        suggestion: 'Add Cache-Control headers for better performance',
      });
    }

    // Check for long-running operations without background processing
    if (content.includes('await') && content.includes('scrape') && !content.includes('background')) {
      issues.push({
        page: `app/api/${file}`,
        type: 'api',
        severity: 'high',
        description: 'Long-running operation in API route',
        suggestion: 'Move long-running operations to background jobs',
      });
    }
  }

  return issues;
}

/**
 * Analyze Next.js config
 */
function analyzeNextConfig(): PageLoadIssue[] {
  const issues: PageLoadIssue[] = [];
  const configFile = path.join(process.cwd(), 'next.config.js');

  if (!fs.existsSync(configFile)) {
    return issues;
  }

  const content = fs.readFileSync(configFile, 'utf-8');

  // Check for missing compression
  if (!content.includes('compress')) {
    issues.push({
      page: 'next.config.js',
      type: 'bundle',
      severity: 'low',
      description: 'Compression not explicitly enabled',
      suggestion: 'Enable compression in next.config.js (usually enabled by default)',
    });
  }

  // Check for missing image optimization config
  if (!content.includes('images')) {
    issues.push({
      page: 'next.config.js',
      type: 'image',
      severity: 'low',
      description: 'No image optimization configuration',
      suggestion: 'Configure images.remotePatterns for external images',
    });
  }

  return issues;
}

/**
 * Generate page load optimization report
 */
export async function generatePageLoadReport(): Promise<PageLoadReport> {
  console.log('⚡ Analyzing page load performance...\n');

  const issues: PageLoadIssue[] = [
    ...analyzePages(),
    ...analyzeAPIPerformance(),
    ...analyzeNextConfig(),
  ];

  // Group by type and severity
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });

  const report: PageLoadReport = {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    byType,
    bySeverity,
    issues,
  };

  // Log summary
  console.log(`📊 Page Load Optimization Report:`);
  console.log(`   Total Issues: ${report.totalIssues}`);
  console.log(`   By Type: ${JSON.stringify(byType)}`);
  console.log(`   By Severity: ${JSON.stringify(bySeverity)}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues Found:`);
    issues.forEach(issue => {
      console.log(`   [${issue.severity.toUpperCase()}] ${issue.page}: ${issue.description}`);
    });
  } else {
    console.log('\n✅ No page load optimization issues found!');
  }

  return report;
}

/**
 * Main entry point
 */
if (require.main === module) {
  generatePageLoadReport()
    .then(async (report) => {
      // Send email if there are high-severity issues
      const highSeverityIssues = report.issues.filter(i => i.severity === 'high');
      if (highSeverityIssues.length > 0) {
        console.log(`\n📧 Sending page load optimization report email (${highSeverityIssues.length} high-severity issues)...`);
        await sendPageLoadOptimizationEmail(report);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Page load optimization agent error:', error);
      process.exit(1);
    });
}

