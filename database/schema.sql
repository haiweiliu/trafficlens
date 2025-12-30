-- Database Schema for Traffic Bulk Extractor
-- Designed for monthly snapshots and trend analysis
-- Compatible with SQLite (local/dev) and PostgreSQL (production)

-- Main table: Stores monthly traffic snapshots
CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    month_year TEXT NOT NULL, -- Format: 'YYYY-MM' (e.g., '2025-01')
    monthly_visits INTEGER,
    avg_session_duration_seconds INTEGER,
    bounce_rate REAL, -- Percentage (0-100)
    pages_per_visit REAL,
    checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'traffic.cv', -- Track data source
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per domain per month
    UNIQUE(domain, month_year)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_domain ON traffic_snapshots(domain);
CREATE INDEX IF NOT EXISTS idx_month_year ON traffic_snapshots(month_year);
CREATE INDEX IF NOT EXISTS idx_domain_month ON traffic_snapshots(domain, month_year);
CREATE INDEX IF NOT EXISTS idx_checked_at ON traffic_snapshots(checked_at);

-- Latest data cache: Quick lookup for current month's data
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

-- Trend analysis: Pre-computed aggregations for faster queries
CREATE TABLE IF NOT EXISTS traffic_trends (
    domain TEXT NOT NULL,
    period_type TEXT NOT NULL, -- '1m', '3m', '6m', '12m'
    start_month TEXT NOT NULL, -- 'YYYY-MM'
    end_month TEXT NOT NULL, -- 'YYYY-MM'
    avg_monthly_visits REAL,
    total_visits INTEGER,
    avg_bounce_rate REAL,
    avg_pages_per_visit REAL,
    data_points INTEGER, -- Number of months included
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (domain, period_type, start_month)
);

CREATE INDEX IF NOT EXISTS idx_trends_domain ON traffic_trends(domain);
CREATE INDEX IF NOT EXISTS idx_trends_period ON traffic_trends(period_type);

-- Failed requests log: Track domains that failed to scrape
CREATE TABLE IF NOT EXISTS scrape_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    error_message TEXT,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    
    -- Track consecutive failures
    UNIQUE(domain, DATE(attempted_at))
);

CREATE INDEX IF NOT EXISTS idx_errors_domain ON scrape_errors(domain);
CREATE INDEX IF NOT EXISTS idx_errors_attempted ON scrape_errors(attempted_at);

-- Metadata: Track data freshness and update schedules
CREATE TABLE IF NOT EXISTS data_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default metadata
-- SimilarWeb releases monthly data by the 10th of following month
-- We add 2-day buffer (cutoff = 12th) to account for delays
INSERT OR IGNORE INTO data_metadata (key, value) VALUES 
    ('last_similarweb_update', '2025-01-01'),
    ('cache_ttl_days', '30'),
    ('data_source', 'traffic.cv (SimilarWeb)'),
    ('update_cutoff_day', '12'),
    ('update_cutoff_buffer_days', '2');

