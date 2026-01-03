# API Health Agent

## Overview
Continuously monitors API endpoints, tests critical workflows, and tracks system availability.

## Purpose
Proactive monitoring to catch API issues before users experience them.

## What It Does

### Health Checks
1. **API Endpoint Availability** - Tests `/api/traffic` endpoint
2. **Database Connectivity** - Verifies database connection
3. **External Service Health** - Monitors traffic.cv availability
4. **Update Endpoint** - Tests `/api/traffic/update` endpoint
5. **Error Rate Tracking** - Analyzes error rates over last 24 hours

### Status Levels
- **Healthy** ✅ - Everything working normally
- **Degraded** ⚠️ - Working but slow or minor issues
- **Unhealthy** ❌ - Critical failures

## Usage

### Run Locally
```bash
npm run health:check
```

### Integration
Can be run in CI/CD pipelines or scheduled as a cron job.

## Output
- Overall health status
- Individual check results
- Response times
- Error rates
- Exit code: 0 (healthy) or 1 (unhealthy)

## Examples

### Healthy System
```
📊 Health Report:
Overall Status: HEALTHY
Healthy: 5/5
Degraded: 0/5
Unhealthy: 0/5
✅ API Endpoint Availability (234ms)
✅ Database Connectivity (5ms)
✅ External Service (traffic.cv) (1234ms)
✅ Update Endpoint (189ms)
✅ Error Rate
```

### Degraded System
```
📊 Health Report:
Overall Status: DEGRADED
Healthy: 3/5
Degraded: 2/5
Unhealthy: 0/5
✅ API Endpoint Availability (234ms)
✅ Database Connectivity (5ms)
⚠️ External Service (traffic.cv) (8500ms)
✅ Update Endpoint (189ms)
⚠️ Error Rate (7.2%)
```

## Configuration

### Environment Variables
- `NEXT_PUBLIC_BASE_URL` - Base URL for API endpoints (default: `http://localhost:3000`)
- `DATABASE_PATH` - Database file path
- `RAILWAY_VOLUME_MOUNT_PATH` - Railway volume mount path

## Integration with Other Agents
- Used by **Performance Monitoring Agent** for baseline metrics
- Used by **Deployment Verification Agent** for pre-deployment checks
- Can trigger alerts for **QA Agent** if issues detected

## Best Practices
1. Run regularly (e.g., every 5-15 minutes)
2. Monitor trends over time
3. Alert on persistent degraded status
4. Use in CI/CD pipelines
5. Track response time percentiles

---

*Part of Phase 2: Important Agents*

