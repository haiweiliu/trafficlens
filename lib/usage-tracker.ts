/**
 * Usage tracking functions for daily statistics
 */

// Import database functions directly
// We'll access the database through the same pattern as db.ts
const Database = require('better-sqlite3');

function getDb() {
  // Use the same database path logic as db.ts
  const dbPath = process.env.DATABASE_PATH || 
                 (process.env.RAILWAY_VOLUME_MOUNT_PATH 
                   ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/traffic.db`
                   : './data/traffic.db');
  
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // Initialize schema if needed (only usage_logs table)
  const schema = `
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
  `;
  db.exec(schema);
  
  return db;
}

/**
 * Log usage statistics for a request
 */
export function logUsage(data: {
  rowsProcessed: number;
  errors: number;
  totalVisits: number;
  cacheHits: number;
  cacheMisses: number;
}): void {
  const database = getDb();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const stmt = database.prepare(`
    INSERT INTO usage_logs (
      date, total_rows, total_errors, total_visits, cache_hits, cache_misses
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_rows = total_rows + excluded.total_rows,
      total_errors = total_errors + excluded.total_errors,
      total_visits = total_visits + excluded.total_visits,
      cache_hits = cache_hits + excluded.cache_hits,
      cache_misses = cache_misses + excluded.cache_misses,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    today,
    data.rowsProcessed,
    data.errors,
    data.totalVisits,
    data.cacheHits,
    data.cacheMisses
  );
}

/**
 * Get usage statistics for a specific date
 */
export function getUsageStats(date: string): {
  date: string;
  totalRows: number;
  totalErrors: number;
  totalVisits: number;
  cacheHits: number;
  cacheMisses: number;
} | null {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM usage_logs WHERE date = ?
  `);

  const row = stmt.get(date) as any;
  if (!row) return null;

  return {
    date: row.date,
    totalRows: row.total_rows || 0,
    totalErrors: row.total_errors || 0,
    totalVisits: row.total_visits || 0,
    cacheHits: row.cache_hits || 0,
    cacheMisses: row.cache_misses || 0,
  };
}

/**
 * Get usage statistics for yesterday (for daily reports)
 */
export function getYesterdayUsageStats(): {
  date: string;
  totalRows: number;
  totalErrors: number;
  totalVisits: number;
  cacheHits: number;
  cacheMisses: number;
} | null {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  return getUsageStats(dateStr);
}

/**
 * Get usage statistics for a date range
 */
export function getUsageStatsRange(startDate: string, endDate: string): Array<{
  date: string;
  totalRows: number;
  totalErrors: number;
  totalVisits: number;
  cacheHits: number;
  cacheMisses: number;
}> {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM usage_logs 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);

  const rows = stmt.all(startDate, endDate) as any[];
  return rows.map(row => ({
    date: row.date,
    totalRows: row.total_rows || 0,
    totalErrors: row.total_errors || 0,
    totalVisits: row.total_visits || 0,
    cacheHits: row.cache_hits || 0,
    cacheMisses: row.cache_misses || 0,
  }));
}

