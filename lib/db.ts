/**
 * Database layer for Traffic Bulk Extractor
 * Uses SQLite for local/dev, PostgreSQL for production
 * Stores monthly snapshots for trend analysis
 */

import Database from 'better-sqlite3';
import { TrafficData } from '@/types';

// Use SQLite for now (can be swapped for PostgreSQL later)
let db: Database.Database | null = null;

/**
 * Get database connection (singleton)
 */
export function getDb(): Database.Database {
  if (!db) {
    // Use Railway's persistent storage or local data directory
    const dbPath = process.env.DATABASE_PATH ||
      (process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/traffic.db`
        : './data/traffic.db');

    // Ensure directory exists
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Better concurrency
    db.pragma('foreign_keys = ON');

    // Initialize schema if needed
    initializeSchema(db);
  }
  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema(database: Database.Database) {
  const schema = `
    CREATE TABLE IF NOT EXISTS traffic_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      month_year TEXT NOT NULL,
      monthly_visits INTEGER,
      avg_session_duration_seconds INTEGER,
      bounce_rate REAL,
      pages_per_visit REAL,
      checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'traffic.cv',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(domain, month_year)
    );

    CREATE INDEX IF NOT EXISTS idx_domain ON traffic_snapshots(domain);
    CREATE INDEX IF NOT EXISTS idx_month_year ON traffic_snapshots(month_year);
    CREATE INDEX IF NOT EXISTS idx_domain_month ON traffic_snapshots(domain, month_year);

    CREATE TABLE IF NOT EXISTS traffic_latest (
      domain TEXT PRIMARY KEY,
      monthly_visits INTEGER,
      avg_session_duration_seconds INTEGER,
      bounce_rate REAL,
      pages_per_visit REAL,
      checked_at TIMESTAMP NOT NULL,
      month_year TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_latest_checked_at ON traffic_latest(checked_at);
    
    -- Migration: Add last_error column if it doesn't exist (safe to run on every startup)
    try {
      database.exec('ALTER TABLE traffic_latest ADD COLUMN last_error TEXT');
    } catch (e) {
      // Column likely already exists, ignore
    }

    CREATE TABLE IF NOT EXISTS traffic_trends (
      domain TEXT NOT NULL,
      period_type TEXT NOT NULL,
      start_month TEXT NOT NULL,
      end_month TEXT NOT NULL,
      avg_monthly_visits REAL,
      total_visits INTEGER,
      avg_bounce_rate REAL,
      avg_pages_per_visit REAL,
      data_points INTEGER,
      calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (domain, period_type, start_month)
    );

    CREATE INDEX IF NOT EXISTS idx_trends_domain ON traffic_trends(domain);

    CREATE TABLE IF NOT EXISTS data_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      total_errors INTEGER NOT NULL DEFAULT 0,
      total_visits BIGINT NOT NULL DEFAULT 0,
      cache_hits INTEGER NOT NULL DEFAULT 0,
      cache_misses INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_logs(date);

    INSERT OR IGNORE INTO data_metadata (key, value) VALUES 
      ('last_similarweb_update', '2025-01-01'),
      ('cache_ttl_days', '30'),
      ('data_source', 'traffic.cv (SimilarWeb)'),
      ('update_cutoff_day', '12'),
      ('update_cutoff_buffer_days', '2');
  `;

  database.exec(schema);
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Convert seconds to formatted duration string (HH:MM:SS)
 * Example: 113 -> "00:01:53"
 */
function formatDurationFromSeconds(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get the month that SimilarWeb data should represent based on current date
 * 
 * SimilarWeb releases monthly data by the 10th of the following month.
 * - If today is before the 12th (10th + 2 day buffer): Previous month's data is latest
 * - If today is on/after the 12th: Current month's data should be available
 */
export function getExpectedDataMonth(): string {
  const now = new Date();
  const currentDay = now.getDate();
  const cutoffDay = 12; // 10th + 2 day buffer

  if (currentDay < cutoffDay) {
    // Before the 12th: Previous month's data is still the latest
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed, so current month
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    // On/after the 12th: Current month's data should be available
    return getCurrentMonth();
  }
}

/**
 * Store traffic data for a specific month
 */
export function storeTrafficDataForMonth(
  data: TrafficData,
  monthYear: string
): void {
  const database = getDb();

  // Insert or update snapshot
  const stmt = database.prepare(`
    INSERT INTO traffic_snapshots (
      domain, month_year, monthly_visits, avg_session_duration_seconds,
      bounce_rate, pages_per_visit, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain, month_year) DO UPDATE SET
      monthly_visits = excluded.monthly_visits,
      avg_session_duration_seconds = excluded.avg_session_duration_seconds,
      bounce_rate = excluded.bounce_rate,
      pages_per_visit = excluded.pages_per_visit,
      checked_at = excluded.checked_at,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    data.domain,
    monthYear,
    data.monthlyVisits,
    data.avgSessionDurationSeconds,
    data.bounceRate,
    data.pagesPerVisit,
    data.checkedAt || new Date().toISOString()
  );
}

/**
 * Store traffic data for current month (backward compatibility)
 */
export function storeTrafficData(data: TrafficData): void {
  const monthYear = getCurrentMonth();
  storeTrafficDataForMonth(data, monthYear);

  // Update latest cache
  const database = getDb();
  const latestStmt = database.prepare(`
    INSERT INTO traffic_latest (
      domain, monthly_visits, avg_session_duration_seconds,
      bounce_rate, pages_per_visit, checked_at, month_year, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET
      monthly_visits = excluded.monthly_visits,
      avg_session_duration_seconds = excluded.avg_session_duration_seconds,
      bounce_rate = excluded.bounce_rate,
      pages_per_visit = excluded.pages_per_visit,
      checked_at = excluded.checked_at,
      month_year = excluded.month_year,
      last_error = excluded.last_error,
      updated_at = CURRENT_TIMESTAMP
  `);

  latestStmt.run(
    data.domain,
    data.monthlyVisits,
    data.avgSessionDurationSeconds,
    data.bounceRate,
    data.pagesPerVisit,
    data.checkedAt || new Date().toISOString(),
    monthYear,
    data.error || null
  );
}

/**
 * Store multiple months of traffic data (for historical data from graph)
 */
export interface MonthlyTrafficData {
  monthYear: string; // Format: "YYYY-MM"
  monthlyVisits: number | null;
}

export function storeHistoricalTrafficData(
  domain: string,
  monthlyData: MonthlyTrafficData[],
  currentData: TrafficData // Current month's full data (with duration, bounce rate, etc.)
): void {
  const database = getDb();
  const checkedAt = currentData.checkedAt || new Date().toISOString();

  // Store each month's visit data
  const stmt = database.prepare(`
    INSERT INTO traffic_snapshots (
      domain, month_year, monthly_visits, avg_session_duration_seconds,
      bounce_rate, pages_per_visit, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain, month_year) DO UPDATE SET
      monthly_visits = excluded.monthly_visits,
      checked_at = excluded.checked_at,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const monthData of monthlyData) {
    // For historical months, we only have visits data
    // Use current month's metrics (duration, bounce rate, etc.) as fallback
    // This is reasonable since these metrics don't change dramatically month-to-month
    stmt.run(
      domain,
      monthData.monthYear,
      monthData.monthlyVisits,
      currentData.avgSessionDurationSeconds, // Use current month's duration
      currentData.bounceRate, // Use current month's bounce rate
      currentData.pagesPerVisit, // Use current month's pages per visit
      checkedAt
    );
  }
}

/**
 * Get latest traffic data for a domain (current month)
 */
export function getLatestTrafficData(domain: string): TrafficData | null {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM traffic_latest WHERE domain = ?
  `);

  const row = stmt.get(domain) as any;
  if (!row) return null;

  return {
    domain: row.domain,
    monthlyVisits: row.monthly_visits,
    avgSessionDuration: formatDurationFromSeconds(row.avg_session_duration_seconds),
    avgSessionDurationSeconds: row.avg_session_duration_seconds,
    bounceRate: row.bounce_rate,
    pagesPerVisit: row.pages_per_visit,
    checkedAt: row.checked_at,
    error: null,
  };
}

/**
 * Get traffic data for multiple domains (latest)
 * Handles www. variations by checking both with and without www.
 */
export function getLatestTrafficDataBatch(domains: string[]): Map<string, TrafficData> {
  const database = getDb();
  const result = new Map<string, TrafficData>();

  // Build query with both www. and non-www. variations
  const allDomainVariations: string[] = [];
  const domainVariationMap = new Map<string, string>(); // db domain variation -> original request domain

  for (const domain of domains) {
    const normalized = domain.toLowerCase().trim();
    const withoutWww = normalized.replace(/^www\./, '');
    const withWww = `www.${withoutWww}`;

    // Map both variations to the original request domain
    domainVariationMap.set(withoutWww, domain);
    if (withWww !== withoutWww) {
      domainVariationMap.set(withWww, domain);
    }

    // Add both variations to query (avoid duplicates)
    if (!allDomainVariations.includes(withoutWww)) {
      allDomainVariations.push(withoutWww);
    }
    if (!allDomainVariations.includes(withWww) && withWww !== withoutWww) {
      allDomainVariations.push(withWww);
    }
  }

  if (allDomainVariations.length === 0) {
    return result;
  }

  const placeholders = allDomainVariations.map(() => '?').join(',');
  const stmt = database.prepare(`
    SELECT * FROM traffic_latest WHERE domain IN (${placeholders})
  `);

  const rows = stmt.all(...allDomainVariations) as any[];

  // Map database results back to original request domains
  for (const row of rows) {
    const dbDomain = row.domain;
    const originalRequestDomain = domainVariationMap.get(dbDomain);

    if (originalRequestDomain) {
      // Only add if we haven't already added this domain (avoid duplicates)
      if (!result.has(originalRequestDomain)) {
        result.set(originalRequestDomain, {
          domain: originalRequestDomain, // Use original request domain
          monthlyVisits: row.monthly_visits,
          avgSessionDuration: formatDurationFromSeconds(row.avg_session_duration_seconds),
          avgSessionDurationSeconds: row.avg_session_duration_seconds,
          bounceRate: row.bounce_rate,
          pagesPerVisit: row.pages_per_visit,
          checkedAt: row.checked_at,
          error: row.last_error || null,
        });
      }
    }
  }

  return result;
}

/**
 * Check if data is fresh based on SimilarWeb's update cadence
 * 
 * SimilarWeb Update Schedule:
 * - Monthly data: Released by the 10th of the following month (sometimes sooner)
 * - Daily data: Released within 72 hours after end of day (EST)
 * 
 * Strategy:
 * - If today is before the 10th: Previous month's data is still valid (new data not released yet)
 * - If today is on/after the 10th: Current month's data should be available
 * - Add 2-day buffer for delays
 */
export function isDataFresh(domain: string, maxAgeDays: number = 30): boolean {
  const database = getDb();

  // Normalize domain for lookup (check both www. and non-www. versions)
  const normalized = domain.toLowerCase().trim();
  const withoutWww = normalized.replace(/^www\./, '');
  const withWww = `www.${withoutWww}`;

  // Try both variations
  const stmt = database.prepare(`
    SELECT checked_at, month_year FROM traffic_latest 
    WHERE domain = ? OR domain = ?
  `);

  const row = stmt.get(withoutWww, withWww) as any;
  if (!row) return false;

  const now = new Date();
  const currentMonth = getCurrentMonth();
  const currentDay = now.getDate();
  const bufferDays = 2; // 2-day buffer for SimilarWeb delays

  // SimilarWeb releases monthly data by the 10th of following month
  // So if we're before the 12th (10th + 2 day buffer), previous month's data is still valid
  const cutoffDay = 10 + bufferDays; // 12th of the month

  // Parse the stored month_year
  const [storedYear, storedMonth] = row.month_year.split('-').map(Number);
  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);

  // Calculate previous month
  let prevYear = currentYear;
  let prevMonth = currentMonthNum - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }
  const previousMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  // Case 1: Data is from current month - always fresh if we're past the cutoff day
  if (row.month_year === currentMonth) {
    // If we're past the 12th, current month data should be available
    if (currentDay >= cutoffDay) {
      const checkedAt = new Date(row.checked_at);
      const ageDays = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Data is fresh if checked within maxAgeDays
      return ageDays <= maxAgeDays;
    }
    // If we're before the 12th, current month data is definitely fresh (just released)
    return true;
  }

  // Case 2: Data is from previous month - valid if we're before the cutoff day
  if (row.month_year === previousMonth) {
    // If we're before the 12th, previous month's data is still valid (new data not released yet)
    if (currentDay < cutoffDay) {
      const checkedAt = new Date(row.checked_at);
      const ageDays = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Also check that data isn't too old (safety check)
      return ageDays <= 45; // Previous month data can be up to ~45 days old
    }
    // If we're past the 12th, previous month data is stale (new data should be available)
    return false;
  }

  // Case 3: Data is from older months - stale
  return false;
}

/**
 * Get historical data for a domain (for trend analysis)
 */
export interface HistoricalData {
  month_year: string;
  monthly_visits: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
}

export function getHistoricalData(
  domain: string,
  months: number = 12
): HistoricalData[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT month_year, monthly_visits, bounce_rate, pages_per_visit
    FROM traffic_snapshots
    WHERE domain = ?
    ORDER BY month_year DESC
    LIMIT ?
  `);

  return stmt.all(domain, months) as HistoricalData[];
}

/**
 * Calculate growth rate (percentage change) from previous month
 * Returns percentage as a number (e.g., 19.66 for +19.66%, -16.62 for -16.62%)
 * Returns null if insufficient data
 */
export function calculateGrowthRate(domain: string): number | null {
  const database = getDb();
  // Get last 2 months of data to calculate growth
  const stmt = database.prepare(`
    SELECT month_year, monthly_visits
    FROM traffic_snapshots
    WHERE domain = ?
    ORDER BY month_year DESC
    LIMIT 2
  `);

  const rows = stmt.all(domain) as Array<{ month_year: string; monthly_visits: number | null }>;

  if (rows.length < 2) {
    return null; // Need at least 2 months of data
  }

  const currentMonth = rows[0];
  const previousMonth = rows[1];

  if (!currentMonth.monthly_visits || !previousMonth.monthly_visits) {
    return null; // Missing data
  }

  if (previousMonth.monthly_visits === 0) {
    return null; // Can't calculate growth from zero
  }

  // Calculate percentage change: ((current - previous) / previous) * 100
  const growthRate = ((currentMonth.monthly_visits - previousMonth.monthly_visits) / previousMonth.monthly_visits) * 100;

  return Math.round(growthRate * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate growth rate for multiple domains (batch)
 */
export function calculateGrowthRateBatch(domains: string[]): Map<string, number | null> {
  const result = new Map<string, number | null>();

  for (const domain of domains) {
    result.set(domain, calculateGrowthRate(domain));
  }

  return result;
}

/**
 * Calculate trends for a domain
 */
export interface TrendData {
  period: '1m' | '3m' | '6m' | '12m';
  avg_monthly_visits: number;
  total_visits: number;
  avg_bounce_rate: number;
  avg_pages_per_visit: number;
  data_points: number;
}

export function calculateTrends(domain: string): TrendData[] {
  const database = getDb();
  const periods = [
    { type: '1m', months: 1 },
    { type: '3m', months: 3 },
    { type: '6m', months: 6 },
    { type: '12m', months: 12 },
  ];

  const trends: TrendData[] = [];

  for (const period of periods) {
    const stmt = database.prepare(`
      SELECT 
        AVG(monthly_visits) as avg_monthly_visits,
        SUM(monthly_visits) as total_visits,
        AVG(bounce_rate) as avg_bounce_rate,
        AVG(pages_per_visit) as avg_pages_per_visit,
        COUNT(*) as data_points
      FROM traffic_snapshots
      WHERE domain = ?
      ORDER BY month_year DESC
      LIMIT ?
    `);

    const row = stmt.get(domain, period.months) as any;
    if (row && row.data_points > 0) {
      trends.push({
        period: period.type as '1m' | '3m' | '6m' | '12m',
        avg_monthly_visits: row.avg_monthly_visits || 0,
        total_visits: row.total_visits || 0,
        avg_bounce_rate: row.avg_bounce_rate || 0,
        avg_pages_per_visit: row.avg_pages_per_visit || 0,
        data_points: row.data_points,
      });
    }
  }

  return trends;
}

/**
 * Get domains with data older than specified days
 */
export function getStaleDomains(maxAgeDays: number = 30): string[] {
  const database = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const stmt = database.prepare(`
    SELECT domain FROM traffic_latest
    WHERE checked_at < ? OR month_year != ?
  `);

  const currentMonth = getCurrentMonth();
  const rows = stmt.all(cutoffDate.toISOString(), currentMonth) as any[];
  return rows.map(row => row.domain);
}

/**
 * Clean up old data (optional: keep only last N months)
 */
export function cleanupOldData(keepMonths: number = 24): void {
  const database = getDb();
  const cutoffMonth = new Date();
  cutoffMonth.setMonth(cutoffMonth.getMonth() - keepMonths);
  const cutoffMonthStr = `${cutoffMonth.getFullYear()}-${String(cutoffMonth.getMonth() + 1).padStart(2, '0')}`;

  const stmt = database.prepare(`
    DELETE FROM traffic_snapshots WHERE month_year < ?
  `);

  stmt.run(cutoffMonthStr);
}

