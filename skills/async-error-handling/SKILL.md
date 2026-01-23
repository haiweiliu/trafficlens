---
name: Async Background Task Error Handling
description: Pattern for handling errors in long-running background tasks to prevent frontend infinite loading states.
---

# Async Background Task Error Handling

This skill outlines the robust pattern for handling background tasks (like scraping, data processing, or AI generation) where a frontend is polling for results.

## The Problem
In naively implemented async systems, background tasks often crash silently (timeouts, OOMs, unhandled exceptions). When this happens, the shared state (Database/Cache) never gets updated. The frontend, seeing no change, continues to poll indefinitely, leading to a "Zombie Loading" state.

## The Solution Pattern
**"Persist All Terminal States"**

Every background task must end in a database write, whether it succeeded or failed.

### 1. Database Schema
Ensure your status tracking table has fields to store error information.

```sql
CREATE TABLE task_results (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  result_data JSON,
  error_message TEXT -- Store the failure reason here
);
```

### 2. Backend Wrapper (The "Safe Runner")
Wrap your background logic in a robust specific error handler that guarantees a DB write.

```typescript
async function safeBackgroundTask(taskId: string, taskLogic: () => Promise<any>) {
  try {
    // 1. Run the actual logic
    const result = await taskLogic();
    
    // 2. On Success: Write result
    await db.update(taskId, {
      status: 'completed',
      result_data: result
    });
    
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);
    
    // 3. On Failure: CRITICAL - Write error to DB
    // This allows the frontend to stop polling
    await db.update(taskId, {
      status: 'failed',
      error_message: error.message || 'Unknown system error'
    });
  }
}
```

### 3. Frontend Polling
The polling logic should check for both success and failure states.

```typescript
const poll = setInterval(async () => {
  const status = await checkStatus(taskId);
  
  if (status.state === 'completed') {
    showResult(status.data);
    clearInterval(poll);
  } 
  else if (status.state === 'failed') {
    // Handle the explicit error state
    showError(status.error_message);
    clearInterval(poll);
  }
  // If 'pending', continue polling...
}, 2000);
```

## Checklist for Implementation
- [ ] **Schema**: Does the DB have an `error` column?
- [ ] **Catch**: Is the background task wrapped in a top-level try/catch?
- [ ] **Persist**: Does the catch block write to the DB?
- [ ] **UI**: Does the frontend poll handler check for error states?

## Reference
Refer to `TrafficLens` implementation where `last_error` was added to `traffic_latest` table to resolve infinite scraping loops.
