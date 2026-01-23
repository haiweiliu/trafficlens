# Learning Log

## [2026-01-22] TrafficLens Infinite Loading Fix

### Situation
The TrafficLens application was experiencing an "infinite loading" state where the UI would say "Scraping..." forever when processing certain domains, particularly on the Railway environment.

### Investigation
- The frontend uses a **polling mechanism** to check the status of background scraping tasks.
- It expects the database record to eventually update with traffic data.
- However, on Railway (free tier), the background scraper would sometimes fail (timeout, OOM, or network error) **without updating the database**.
- This left the database record in a "missing" state, causing the frontend to keep polling indefinitely.

### Resolution
The fix involved ensuring that **all** terminal states of the background process (success OR failure) are recorded in the database.

1.  **Database Schema**: Added a `last_error` column to the `traffic_latest` table.
2.  **Backend Logic**: Wrapped the background scraper batch processor in a try/catch block that **explicitly writes the error to the DB** if the batch fails.
3.  **Frontend Logic**: The polling endpoint (`/api/traffic/update`) now returns the `last_error` field, allowing the frontend (which was already handling errors, but receiving none) to display the failure message.

### Key Takeaway
When building async/polling architectures, **failure is a valid state that must be persisted**. If a background worker crashes silently, the system enters a zombie state. Always capture failures and write them to the shared state (DB/Cache) so the client can stop waiting.

## [2026-01-22] SQL String Embedding Error

### Situation
After deploying the fix, the app returned `500 Internal Server Error` with `Error: near "try": syntax error`.

### Cause
We attempted to run a migration by embedding TypeScript logic *inside* a SQL execution string:

```typescript
// BAD
const schema = `
  CREATE TABLE ...;
  try { ... } catch (e) { ... } // <--- This is treated as SQL!
`;
db.exec(schema);
```

### Resolution
Move imperative logic (like `try/catch` checks) *outside* of SQL strings.

```typescript
// GOOD
const schema = `CREATE TABLE ...;`;
db.exec(schema);

try {
   // Run migration logic as TS code
   db.exec('ALTER TABLE ...');
} catch (e) { ... }
```

### Key Takeaway
Strings passed to `db.exec()` must be pure SQL. Do not mix language constructs. Migration scripts often require a mix of SQL (for data) and code (for control flow); keep them separate.
