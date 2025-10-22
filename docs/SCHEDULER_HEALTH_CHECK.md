# Scheduler Health Check & Monitoring

Comprehensive health check and monitoring system for the Sokapost schedulers.

## Overview

The application has two critical schedulers:
1. **Post Scheduler** - Publishes scheduled social media posts every minute
2. **Auto-Reply Scheduler** - Monitors and auto-replies to Threads comments (default: every 5 minutes)

This health check system provides real-time monitoring, metrics tracking, and health status for both schedulers.

## Health Check Endpoint

### GET `/api/health`

Returns comprehensive health status and metrics for all schedulers.

**Response Structure:**
```json
{
  "status": "healthy" | "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "schedulers": {
    "postScheduler": {
      "name": "Post Scheduler",
      "running": true,
      "healthy": true,
      "health": {
        "healthy": true,
        "issues": [],
        "lastExecution": "2024-01-15T10:29:00.000Z",
        "errorRate": 0.05
      },
      "metrics": {
        "name": "post-scheduler",
        "running": true,
        "totalExecutions": 150,
        "successCount": 145,
        "failureCount": 5,
        "lastExecutionTime": "2024-01-15T10:29:00.000Z",
        "lastSuccessTime": "2024-01-15T10:29:00.000Z",
        "lastFailureTime": "2024-01-15T09:15:00.000Z",
        "lastError": null,
        "averageExecutionTimeMs": 850,
        "itemsProcessed": 45,
        "itemsFailed": 2
      }
    },
    "autoReplyScheduler": {
      "name": "Auto-Reply Scheduler",
      "running": true,
      "healthy": true,
      "interval": "5 minutes",
      "health": { /* same structure */ },
      "metrics": { /* same structure */ }
    }
  },
  "summary": {
    "totalSchedulers": 2,
    "healthySchedulers": 2,
    "runningSchedulers": 2,
    "allMetrics": [ /* array of all metrics */ ]
  }
}
```

**HTTP Status Codes:**
- `200` - All schedulers are healthy
- `503` - One or more schedulers are unhealthy
- `500` - Error checking health status

## Health Criteria

A scheduler is considered **healthy** when:
1. ✅ Scheduler is running
2. ✅ Last execution was within 10 minutes (not stuck)
3. ✅ Error rate is below 50%

A scheduler is **unhealthy** when:
- ❌ Scheduler is not running
- ❌ No execution in 10+ minutes (might be stuck)
- ❌ Error rate exceeds 50%
- ❌ Recent critical errors

## Metrics Tracked

For each scheduler, the following metrics are tracked:

| Metric | Description |
|--------|-------------|
| `totalExecutions` | Total number of times the scheduler ran |
| `successCount` | Number of successful executions |
| `failureCount` | Number of failed executions |
| `lastExecutionTime` | Timestamp of last execution |
| `lastSuccessTime` | Timestamp of last successful execution |
| `lastFailureTime` | Timestamp of last failure |
| `lastError` | Error message from last failure |
| `averageExecutionTimeMs` | Average execution time in milliseconds |
| `itemsProcessed` | Total items successfully processed |
| `itemsFailed` | Total items that failed processing |

## Additional Status Endpoints

### GET `/api/debug/scheduler-status`

Returns detailed status for the **Post Scheduler** including:
- Scheduler running status
- Health metrics
- Scheduled posts list
- Overdue posts
- Recent post history

**Authentication:** Required (user session)

### GET `/api/auto-reply/scheduler/status`

Returns detailed status for the **Auto-Reply Scheduler** including:
- Scheduler running status
- Execution interval
- Health metrics
- Configuration details

**Authentication:** Required (user session)

## Monitoring Setup

### 1. Basic Health Check

Use the `/api/health` endpoint for automated monitoring:

```bash
# Check health status
curl https://your-domain.com/api/health

# Check exit code (0 = healthy, non-zero = unhealthy)
curl -f https://your-domain.com/api/health && echo "Healthy" || echo "Unhealthy"
```

### 2. Uptime Monitoring

Configure your monitoring service (e.g., UptimeRobot, Pingdom, New Relic) to:
- Monitor: `https://your-domain.com/api/health`
- Interval: Every 5 minutes
- Alert on: HTTP 503 or 500 status codes

### 3. Alerting Rules

Recommended alerts:

**Critical Alerts:**
- ⚠️ Scheduler not running
- ⚠️ No execution in 10+ minutes
- ⚠️ Error rate > 50%

**Warning Alerts:**
- ⚡ Error rate 20-50%
- ⚡ Average execution time > 5 seconds
- ⚡ Failed items count increasing

### 4. Log Monitoring

Watch for these log patterns in server console:

**Post Scheduler:**
```
🔍 Checking for posts to publish at [timestamp]
✅ Published post [id] to [platform]
❌ Failed to publish post [id]: [error]
```

**Auto-Reply Scheduler:**
```
🤖 [Auto-Reply] Starting job at [time]...
✅ [Auto-Reply] Job completed at [time]
❌ [Auto-Reply] Job failed: [error]
```

## Example Monitoring Script

```bash
#!/bin/bash
# scheduler-monitor.sh

HEALTH_URL="https://your-domain.com/api/health"
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Check health
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health.json $HEALTH_URL)
HTTP_CODE="${RESPONSE: -3}"

if [ "$HTTP_CODE" != "200" ]; then
  # Parse issues
  ISSUES=$(jq -r '.schedulers | to_entries | map(select(.value.healthy == false) | .key + ": " + (.value.health.issues | join(", "))) | join("\n")' /tmp/health.json)
  
  # Send alert
  curl -X POST $WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚨 Scheduler Health Alert\n\n$ISSUES\"}"
fi
```

## Dashboard Example

You can create a simple monitoring dashboard using the health check data:

```typescript
// components/SchedulerHealthDashboard.tsx
export function SchedulerHealthDashboard() {
  const { data } = useSWR('/api/health', fetcher, {
    refreshInterval: 30000 // Refresh every 30 seconds
  })

  return (
    <div>
      <h2>Scheduler Health</h2>
      <StatusBadge status={data?.status} />
      
      {Object.entries(data?.schedulers || {}).map(([key, scheduler]) => (
        <SchedulerCard key={key} scheduler={scheduler} />
      ))}
      
      <MetricsChart data={data?.summary?.allMetrics} />
    </div>
  )
}
```

## Troubleshooting

### Scheduler Not Running

If a scheduler shows as not running:

1. Check server logs for errors
2. Restart the application
3. Verify environment variables
4. Check database connectivity

### High Error Rate

If error rate is high:

1. Check recent errors in logs
2. Verify API credentials (access tokens)
3. Check rate limits on social media platforms
4. Review database connection issues

### Stuck Scheduler

If no execution in 10+ minutes:

1. Check if cron job is configured correctly
2. Restart the application
3. Check for deadlocks in database
4. Review server resource usage (CPU/memory)

## Integration with APM Tools

### Datadog

```typescript
import { metricsCollector } from '@/lib/services/scheduler-metrics'

// Send metrics to Datadog
const metrics = metricsCollector.getAllMetrics()
metrics.forEach(m => {
  statsd.gauge(`scheduler.${m.name}.executions`, m.totalExecutions)
  statsd.gauge(`scheduler.${m.name}.error_rate`, m.failureCount / m.totalExecutions)
})
```

### New Relic

```typescript
// Track custom metrics
newrelic.recordMetric('Custom/Scheduler/PostScheduler/Executions', totalExecutions)
newrelic.recordMetric('Custom/Scheduler/PostScheduler/ErrorRate', errorRate)
```

## Best Practices

1. **Monitor regularly** - Check health every 5 minutes
2. **Set up alerts** - Configure alerts for critical issues
3. **Review metrics** - Analyze trends weekly
4. **Keep logs** - Maintain logs for at least 30 days
5. **Test alerts** - Verify alerting system works
6. **Document incidents** - Keep record of scheduler issues

## Support

For issues or questions about scheduler health monitoring:
- Check server logs first
- Review this documentation
- Contact the development team
