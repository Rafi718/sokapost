import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-api'
import {
  getAllRateLimitStatuses,
  getAutoReplyRateLimit,
  getSeverityLevel,
  formatTimeUntilReset
} from '@/lib/security/rate-limit-tracker'
import { RATE_LIMITS } from '@/lib/security/rate-limit'

// GET - Get all rate limit statuses with predictions
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all rate limit statuses
    const statuses = await getAllRateLimitStatuses(session.user.id)
    
    // Get auto-reply rate limit (separate from API rate limits)
    const autoReplyStatus = await getAutoReplyRateLimit(session.user.id)

    // Build enhanced response with severity and formatted data
    const enhancedStatuses = Object.entries(statuses).reduce((acc, [type, status]) => {
      if (!status) return acc

      const config = RATE_LIMITS[type as keyof typeof RATE_LIMITS]
      
      acc[type] = {
        ...status,
        severity: getSeverityLevel(status.usagePercentage),
        resetAtFormatted: status.resetAt.toLocaleString(),
        resetInFormatted: formatTimeUntilReset(status.resetInSeconds),
        description: getDescription(type),
        windowDescription: formatWindowDescription(config.window)
      }
      
      return acc
    }, {} as any)

    // Add auto-reply if available
    if (autoReplyStatus) {
      enhancedStatuses.autoReply = {
        ...autoReplyStatus,
        severity: getSeverityLevel(autoReplyStatus.usagePercentage),
        resetAtFormatted: autoReplyStatus.resetAt.toLocaleString(),
        resetInFormatted: formatTimeUntilReset(autoReplyStatus.resetInSeconds),
        description: 'Automatic replies to Threads comments',
        windowDescription: 'Per hour'
      }
    }

    // Calculate overall status
    const allStatuses = Object.values(enhancedStatuses)
    const criticalCount = allStatuses.filter((s: any) => s.severity === 'error').length
    const warningCount = allStatuses.filter((s: any) => s.severity === 'warning').length
    const willHitLimit = allStatuses.some((s: any) => s.prediction?.willHitLimit)

    return NextResponse.json({
      success: true,
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      summary: {
        totalLimits: allStatuses.length,
        critical: criticalCount,
        warning: warningCount,
        healthy: allStatuses.length - criticalCount - warningCount,
        willHitLimitSoon: willHitLimit
      },
      limits: enhancedStatuses
    })
  } catch (error: any) {
    console.error('Rate limits status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}

function getDescription(type: string): string {
  const descriptions: Record<string, string> = {
    ai: 'AI content generation requests',
    post: 'Social media post creation',
    upload: 'Media file uploads',
    auth: 'Authentication attempts',
    autoReply: 'Auto-reply trigger requests',
    general: 'General API requests',
    analytics: 'Smart analytics generation'
  }
  return descriptions[type] || 'API requests'
}

function formatWindowDescription(seconds: number): string {
  if (seconds < 60) {
    return `Per ${seconds} seconds`
  } else if (seconds === 60) {
    return 'Per minute'
  } else if (seconds === 900) {
    return 'Per 15 minutes'
  } else if (seconds === 3600) {
    return 'Per hour'
  } else if (seconds === 86400) {
    return 'Per day'
  } else if (seconds < 3600) {
    return `Per ${Math.floor(seconds / 60)} minutes`
  } else {
    return `Per ${Math.floor(seconds / 3600)} hours`
  }
}
