# Rate Limit Prediction System

Comprehensive rate limit tracking and prediction system to help users avoid hitting API limits.

## Overview

The Rate Limit Prediction System provides real-time monitoring of all API rate limits, predicts when limits will be reached based on usage patterns, and offers recommendations to avoid limit violations.

## Features

### 1. **Real-Time Monitoring**
- Tracks usage across all rate limit types
- Shows current usage vs limits
- Displays time until limit resets
- Visual progress bars with color-coded severity

### 2. **Intelligent Prediction**
- Calculates current and average request rates
- Predicts time until limit will be hit
- Confidence levels based on data consistency
- Personalized recommendations

### 3. **Rate Limit Types Tracked**

| Type | Limit | Window | Description |
|------|-------|--------|-------------|
| AI | 10 requests | Per minute | AI content generation |
| Post | 20 posts | Per hour | Social media post creation |
| Upload | 30 uploads | Per hour | Media file uploads |
| Auth | 5 attempts | Per 15 minutes | Authentication attempts |
| Auto-Reply | 30 requests | Per hour | Auto-reply API triggers |
| General | 100 requests | Per minute | General API requests |
| Analytics | 1 request | Per day | Smart analytics generation |
| Auto-Reply (User) | Configurable | Per hour | Automatic replies sent |

### 4. **Severity Levels**

- **🟢 Success** (0-70% usage): Healthy usage, continue normally
- **🟡 Warning** (70-90% usage): Approaching limit, reduce usage
- **🔴 Critical** (90-100% usage): Near or at limit, slow down immediately

## Dashboard

### Access
Navigate to: **Settings → Rate Limits** or visit `/rate-limits`

### Dashboard Components

#### Summary Cards
- **Total Limits**: Number of active rate limits
- **Healthy**: Limits below 70% usage
- **Warning**: Limits at 70-90% usage
- **Critical**: Limits above 90% usage

#### Rate Limit Cards
Each rate limit displays:
- Current usage (used/total)
- Usage percentage with progress bar
- Time until reset
- Prediction section with:
  - Will limit be hit (Yes/No)
  - Predicted time until limit
  - Current vs average request rate
  - Confidence level
  - Personalized recommendation

## API Endpoints

### GET `/api/rate-limits`

Returns comprehensive rate limit status for the authenticated user.

**Response Structure:**
```json
{
  "success": true,
  "userId": "user123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalLimits": 8,
    "critical": 1,
    "warning": 2,
    "healthy": 5,
    "willHitLimitSoon": true
  },
  "limits": {
    "ai": {
      "type": "ai",
      "limit": 10,
      "used": 7,
      "remaining": 3,
      "resetAt": "2024-01-15T10:31:00.000Z",
      "resetInSeconds": 60,
      "resetAtFormatted": "1/15/2024, 10:31:00 AM",
      "resetInFormatted": "1m",
      "usagePercentage": 70,
      "windowSeconds": 60,
      "windowDescription": "Per minute",
      "description": "AI content generation requests",
      "severity": "warning",
      "prediction": {
        "willHitLimit": true,
        "predictedTimeUntilLimit": 45,
        "predictedHitTime": "2024-01-15T10:30:45.000Z",
        "currentRate": 0.12,
        "averageRate": 0.10,
        "confidence": "high",
        "recommendation": "⚡ Warning: Approaching limit, reduce usage"
      }
    },
    // ... other limits
  }
}
```

**Authentication:** Required (user session)

## How Prediction Works

### 1. Data Collection
- System tracks usage over time
- Stores last 10 data points per limit type
- Captures timestamps and request counts

### 2. Rate Calculation
```
Current Rate = (Recent Usage - Previous Usage) / Time Span
Average Rate = (Total Usage - Initial Usage) / Total Time Span
```

### 3. Prediction Algorithm
```
Remaining Requests = Limit - Current Usage
Effective Rate = Max(Current Rate, Average Rate)
Time Until Limit = Remaining Requests / Effective Rate
```

### 4. Confidence Level
- **High Confidence**: Rate variance < 20%
- **Medium Confidence**: Rate variance 20-50%
- **Low Confidence**: Rate variance > 50% or insufficient data

### 5. Recommendations
Based on usage percentage and predicted time:
- **0-70%**: ✅ Usage is healthy
- **70-90%**: ⚡ Warning: Approaching limit, reduce usage
- **90-100%**: ⚠️ Critical: Slow down requests immediately

## Usage Examples

### Monitoring Auto-Reply Limits

The auto-reply rate limit is particularly important for automated workflows:

```typescript
// Check current auto-reply usage
const response = await fetch('/api/rate-limits')
const data = await response.json()
const autoReply = data.limits.autoReply

console.log(`Auto-replies sent: ${autoReply.used}/${autoReply.limit}`)
console.log(`Resets in: ${autoReply.resetInFormatted}`)

if (autoReply.prediction.willHitLimit) {
  console.warn(`⚠️ Will hit limit in ${autoReply.prediction.predictedTimeUntilLimit}s`)
}
```

### Integrating with Your App

```typescript
import useSWR from 'swr'

function MyComponent() {
  const { data } = useSWR('/api/rate-limits', {
    refreshInterval: 10000 // Update every 10 seconds
  })

  // Show warning if any limit is critical
  const hasCritical = data?.summary.critical > 0

  if (hasCritical) {
    return <AlertBanner>Rate limit critical - slow down requests!</AlertBanner>
  }

  return <YourContent />
}
```

### Preemptive Throttling

```typescript
async function makeAPICall() {
  // Check rate limit before making call
  const limits = await fetch('/api/rate-limits').then(r => r.json())
  const aiLimit = limits.limits.ai

  // If usage > 90%, delay the request
  if (aiLimit.usagePercentage > 90) {
    const delay = aiLimit.resetInSeconds * 1000
    console.log(`Throttling request for ${delay}ms to avoid limit`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // Now safe to make the call
  return await fetch('/api/ai/generate', { ... })
}
```

## Best Practices

### 1. **Monitor Regularly**
- Check dashboard daily
- Set up browser notifications for critical limits
- Review usage patterns weekly

### 2. **Respond to Warnings**
- **Warning (70-90%)**: Reduce non-essential API calls
- **Critical (90%+)**: Stop making new requests until reset

### 3. **Optimize Usage**
- Batch requests when possible
- Cache responses to avoid duplicate calls
- Use webhooks instead of polling

### 4. **Configure Auto-Reply Wisely**
- Set `maxRepliesPerHour` based on expected comment volume
- Monitor reply rate during peak times
- Use manual mode for sensitive conversations

### 5. **Plan for Limits**
- Schedule bulk operations during off-peak hours
- Spread out analytics generation
- Avoid rapid-fire AI generation

## Troubleshooting

### "Prediction shows low confidence"
**Cause**: Insufficient historical data or inconsistent usage patterns
**Solution**: Continue using the system normally for more accurate predictions

### "Rate limit reached unexpectedly"
**Cause**: Sudden spike in usage or concurrent requests
**Solution**: 
- Check for automated processes making unplanned requests
- Review recent activity in dashboard
- Wait for limit to reset (check `resetInFormatted`)

### "Dashboard not updating"
**Cause**: Browser cache or API issue
**Solution**:
- Click the "Refresh" button in dashboard
- Hard refresh browser (Ctrl+F5)
- Check browser console for errors

### "Auto-reply limit shows 0"
**Cause**: No auto-reply settings configured
**Solution**: Visit Auto-Reply settings page to configure

## Advanced Features

### Custom Alerts (Future Enhancement)
```typescript
// Set up custom threshold alerts
setRateLimitAlert('ai', 80, () => {
  sendNotification('AI limit at 80%')
})
```

### Export Usage Data (Future Enhancement)
```typescript
// Export rate limit history for analysis
const history = await exportRateLimitHistory('last_30_days')
```

### Integration with Monitoring Tools (Future Enhancement)
```typescript
// Send metrics to external monitoring
sendToDatadog({
  metric: 'rate_limit.usage',
  value: aiLimit.usagePercentage,
  tags: ['type:ai', 'user:123']
})
```

## Rate Limit Values Reference

### Threads API Limits (Official)
- Post creation: ~50 per day per account
- Comments: Limited by engagement
- Search: No official limit documented

### Instagram API Limits (Official)
- Posts: 25 per day per account
- API calls: 200 per hour per user
- Media: Limited by account type

### Application Limits (Configured)
See table at top of document for all application-level limits.

## Support

For issues with rate limit prediction:
1. Check dashboard for current status
2. Review usage patterns in last hour
3. Verify limit configurations in `.env`
4. Contact support with:
   - Rate limit type
   - Usage percentage
   - Prediction details
   - Recent activity

## Configuration

Rate limits are configured in `lib/security/rate-limit.ts`:

```typescript
export const RATE_LIMITS = {
  ai: { requests: 10, window: 60 },        // 10 per minute
  post: { requests: 20, window: 3600 },    // 20 per hour
  upload: { requests: 30, window: 3600 },  // 30 per hour
  // ... etc
}
```

To modify limits, update these values and restart the application.

**Note**: Auto-reply user limits are configured per-user in the Auto-Reply settings page.

## Privacy & Data

- Rate limit data is stored per-user
- Prediction history is kept in memory (not persisted)
- Usage data is not shared between users
- Data resets on application restart

---

**Last Updated**: January 2024
**Version**: 1.0.0
