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
function getDb(): Database.Database {
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
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_latest_checked_at ON traffic_latest(checked_at);

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

    INSERT OR IGNORE INTO data_metadata (key, value) VALUES 
      ('last_similarweb_update', '2025-01-01'),
      ('cache_ttl_days', '30'),
      ('data_source', 'traffic.cv (SimilarWeb)');
  `;
  
  database.exec(schema);
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Store traffic data for current month
 */
export function storeTrafficData(data: TrafficData): void {
  const database = getDb();
  const monthYear = getCurrentMonth();
  
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
  
  // Update latest cache
  const latestStmt = database.prepare(`
    INSERT INTO traffic_latest (
      domain, monthly_visits, avg_session_duration_seconds,
      bounce_rate, pages_per_visit, checked_at, month_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET
      monthly_visits = excluded.monthly_visits,
      avg_session_duration_seconds = excluded.avg_session_duration_seconds,
      bounce_rate = excluded.bounce_rate,
      pages_per_visit = excluded.pages_per_visit,
      checked_at = excluded.checked_at,
      month_year = excluded.month_year,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  latestStmt.run(
    data.domain,
    data.monthlyVisits,
    data.avgSessionDurationSeconds,
    data.bounceRate,
    data.pagesPerVisit,
    data.checkedAt || new Date().toISOString(),
    monthYear
  );
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
    avgSessionDuration: null, // Convert seconds to string if needed
    avgSessionDurationSeconds: row.avg_session_duration_seconds,
    bounceRate: row.bounce_rate,
    pagesPerVisit: row.pages_per_visit,
    checkedAt: row.checked_at,
    error: null,
  };
}

/**
 * Get traffic data for multiple domains (latest)
 */
export function getLatestTrafficDataBatch(domains: string[]): Map<string, TrafficData> {
  const database = getDb();
  const placeholders = domains.map(() => '?').join(',');
  const stmt = database.prepare(`
    SELECT * FROM traffic_latest WHERE domain IN (${placeholders})
  `);
  
  const rows = stmt.all(...domains) as any[];
  const result = new Map<string, TrafficData>();
  
  for (const row of rows) {
    result.set(row.domain, {
      domain: row.domain,
      monthlyVisits: row.monthly_visits,
      avgSessionDuration: null,
      avgSessionDurationSeconds: row.avg_session_duration_seconds,
      bounceRate: row.bounce_rate,
      pagesPerVisit: row.pages_per_visit,
      checkedAt: row.checked_at,
      error: null,
    });
  }
  
  return result;
}

/**
 * Check if data is fresh (within current month, checked recently)
 * SimilarWeb updates monthly, so we cache for the entire month
 */
export function isDataFresh(domain: string, maxAgeDays: number = 30): boolean {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT checked_at, month_year FROM traffic_latest 
    WHERE domain = ?
  `);
  
  const row = stmt.get(domain) as any;
  if (!row) return false;
  
  const currentMonth = getCurrentMonth();
  // If data is from current month and checked within maxAgeDays, it's fresh
  if (row.month_year === currentMonth) {
    const checkedAt = new Date(row.checked_at);
    const ageDays = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= maxAgeDays;
  }
  
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

