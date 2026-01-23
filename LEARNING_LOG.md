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
