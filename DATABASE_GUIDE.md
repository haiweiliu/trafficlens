# 📊 Database Structure & Strategy

## Overview

Since Traffic.cv data comes from **SimilarWeb** which updates **monthly**, we can:
- ✅ Cache data for **entire month** (saves bandwidth)
- ✅ Store **historical snapshots** for trend analysis
- ✅ Enable **monthly, 3-month, 6-month, yearly trends**

## Database Schema

### 1. `traffic_snapshots` (Main Table)
Stores monthly snapshots of traffic data.

**Key Fields:**
- `domain` + `month_year` (unique) - One record per domain per month
- `monthly_visits`, `bounce_rate`, `pages_per_visit`, etc.
- `checked_at` - When data was scraped
- `source` - 'traffic.cv' (SimilarWeb)

**Why monthly?** SimilarWeb updates monthly, so we store one snapshot per month.

### 2. `traffic_latest` (Cache Table)
Quick lookup for current month's data.

**Purpose:** Fast access to latest data without querying snapshots.

### 3. `traffic_trends` (Pre-computed Trends)
Stores calculated trends for faster queries.

**Periods:** 1m, 3m, 6m, 12m
**Data:** Averages, totals, data point counts

### 4. `scrape_errors` (Error Tracking)
Tracks failed scraping attempts.

**Purpose:** Avoid re-scraping domains that consistently fail.

### 5. `data_metadata` (Configuration)
Stores metadata like last SimilarWeb update date, cache TTL, etc.

## Caching Strategy

### Data Freshness Logic (Based on SimilarWeb Update Cadence)

**SimilarWeb Update Schedule:**
- **Monthly Data**: Released by the **10th of the following month** (sometimes sooner)
- **Daily Data**: Released within **72 hours** after end of day (EST)

**Our Caching Strategy:**
- **Before the 12th of the month** (10th + 2-day buffer): Previous month's data is still valid (new data not released yet)
- **On/after the 12th of the month**: Current month's data should be available
- **Buffer**: 2-day buffer added to account for SimilarWeb delays

**Examples:**
- **January 5th**: December data is still fresh (new January data not released yet)
- **January 12th**: January data should be available (released by 10th + buffer)
- **January 15th**: January data should be available

**Why this works:**
- Prevents unnecessary scraping when new data isn't available yet
- Accounts for SimilarWeb's release schedule
- Adds buffer for delays

### Historical Data
- **Stored**: Monthly snapshots indefinitely (or configurable retention)
- **Use**: Trend analysis, comparisons

## API Endpoints

### Existing: `POST /api/traffic`
- Now stores data in database
- Checks database first (monthly cache)
- Falls back to scraping if data is stale

### New: `GET /api/trends?domain=example.com&period=3m`
- Returns historical data and trends
- Periods: 1m, 3m, 6m, 12m

## Usage Examples

### Check if domain needs scraping:
```typescript
if (isDataFresh(domain, 30)) {
  // Use cached data (from database)
} else {
  // Scrape fresh data
}
```

### Get trends:
```typescript
const trends = calculateTrends('example.com');
// Returns: [{ period: '1m', ... }, { period: '3m', ... }, ...]
```

### Get historical data:
```typescript
const history = getHistoricalData('example.com', 12); // Last 12 months
```

## Database Choice

### Current: SQLite
- ✅ Simple, no setup needed
- ✅ Works locally and on Railway
- ✅ File-based (easy backups)
- ✅ Good for MVP

### Future: PostgreSQL (Optional)
- Better for production at scale
- More concurrent connections
- Better for complex queries
- Can migrate later if needed

## Setup

1. **Install dependencies:**
   ```bash
   npm install better-sqlite3
   npm install --save-dev @types/better-sqlite3
   ```

2. **Database auto-creates** on first use
   - Location: `./data/traffic.db` (or set `DATABASE_PATH` env var)

3. **Schema auto-initializes** when `getDb()` is first called

## Benefits

1. **Bandwidth Savings**: 
   - Scrape once per month per domain
   - ~97% reduction in scraping (30 days vs daily)

2. **Trend Analysis**:
   - Monthly trends
   - 3-month, 6-month, yearly comparisons
   - Growth/decline tracking

3. **Performance**:
   - Fast database lookups
   - Pre-computed trends
   - No repeated scraping

4. **Cost Savings**:
   - Less Railway usage (fewer scrapes)
   - Lower bandwidth costs

## Migration Path

1. **Phase 1** (Current): SQLite + database storage
2. **Phase 2** (Optional): Add PostgreSQL for production
3. **Phase 3** (Future): Add trend visualization UI

---

**The database structure is ready! It will auto-create on first use.**

