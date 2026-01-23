---
name: Proxy Management
description: Best practices and configuration for using Proxies (specifically PyProxy) in this project.
---

# Proxy Management

This skill documents how to correctly configure and use proxies for scraping, specifically focusing on **PyProxy**.

## PyProxy Configuration

We use **PyProxy** with **Sticky IP (Session)** mode for the best balance of speed and reliability.

- **Host**: `c36288e57056c2d5.byi.na.pyproxy.io`
- **Port**: `16666`
- **Protocol**: HTTP/HTTPS
- **Password**: `G12345678`

### Sticky IP vs Random IP

- **Sticky IP (`zone-resi-session-...`)**: Keeps the same IP for a duration (e.g., 30 mins). faster because the connection is established once. **Recommended for general use.**
- **Random IP (`zone-resi`)**: Rotates IP on every single request. Slower due to handshake overhead per request. Use only if getting blocked frequently on a single target.

### Constructing Credentials

To use a Sticky IP, you must construct the username dynamically with a `sessionId`.

**Format:**
`proxyming123-zone-resi-session-{SESSION_ID}-sessTime-{DURATION}`

- `SESSION_ID`: A random string (e.g., 8 alphanumeric chars). Using the same ID reuses the same IP.
- `DURATION`: Session time in minutes (e.g., `30` or `120`).

### Code Example (Playwright)

```typescript
import { chromium } from 'playwright';

async function getBrowser() {
    // Generate a random session ID for this browser instance
    const sessionId = Math.random().toString(36).substring(2, 10);
    
    return await chromium.launch({
        headless: true,
        proxy: {
            server: 'http://c36288e57056c2d5.byi.na.pyproxy.io:16666',
            username: `proxyming123-zone-resi-session-${sessionId}-sessTime-30`,
            password: 'G12345678'
        }
    });
}
```

### Best Practices

1.  **Session Rotation**: If you are making many requests to the **same domain**, generate a new `sessionId` every ~10-20 requests to avoid behavior-based blocking.
2.  **Concurrency**: Different concurrent workers should use **different** `sessionId`s to avoid sharing the same IP throughput limit.
3.  **Error Handling**: If a proxy connection fails, retry with a NEW `sessionId` immediately.
