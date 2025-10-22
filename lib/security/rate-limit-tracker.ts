import { Redis } from '@upstash/redis'
import { RATE_LIMITS, RateLimitType } from './rate-limit'

// Rate limit tracking and prediction system

export interface RateLimitStatus {
  type: RateLimitType
  limit: number
  used: number
  remaining: number
  resetAt: Date
  resetInSeconds: number
  usagePercentage: number
  windowSeconds: number
  prediction?: RateLimitPrediction
}

export interface RateLimitPrediction {
  willHitLimit: boolean
  predictedTimeUntilLimit: number | null // seconds
  predictedHitTime: Date | null
  currentRate: number // requests per second
  averageRate: number // requests per second
  confidence: 'high' | 'medium' | 'low'
  recommendation: string
}

export interface UsageTrend {
  timestamp: number
  count: number
}

// Initialize Redis client
let redis: Redis | null = null
let redisEnabled = false

try {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  
  // Check if Redis is properly configured (not placeholder values)
  if (
    redisUrl && 
    redisToken && 
    !redisUrl.includes('your-redis-instance') &&
    !redisUrl.includes('your-instance') &&
    redisUrl.startsWith('http')
  ) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    })
    redisEnabled = true
    console.log('✅ Rate limit tracker: Redis enabled')
  } else {
    console.log('⚠️ Rate limit tracker: Using in-memory fallback (Redis not configured)')
  }
} catch (error) {
  console.error('❌ Failed to initialize Redis for rate limit tracker:', error)
  redisEnabled = false
}

// In-memory fallback for tracking usage patterns
const usageHistory: Map<string, UsageTrend[]> = new Map()

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(
  userId: string,
  type: RateLimitType
): Promise<RateLimitStatus | null> {
  const config = RATE_LIMITS[type]
  
  if (!redis || !redisEnabled) {
    // Fallback to basic info without actual tracking
    return {
      type,
      limit: config.requests,
      used: 0,
      remaining: config.requests,
      resetAt: new Date(Date.now() + config.window * 1000),
      resetInSeconds: config.window,
      usagePercentage: 0,
      windowSeconds: config.window,
      prediction: {
        willHitLimit: false,
        predictedTimeUntilLimit: null,
        predictedHitTime: null,
        currentRate: 0,
        averageRate: 0,
        confidence: 'low',
        recommendation: 'Redis not configured - using fallback mode'
      }
    }
  }

  try {
    // Get the rate limit data from Upstash
    const key = `ratelimit:${type}:${userId}`
    const data = await redis.get(key)
    
    // Upstash stores the data in a specific format
    // We need to calculate usage based on the sliding window
    const pattern = `${key}:*`
    const keys = await redis.keys(pattern)
    
    // Count requests in current window
    const now = Date.now()
    const windowStart = now - (config.window * 1000)
    
    let used = 0
    if (keys && keys.length > 0) {
      // Count keys that are still within the window
      for (const k of keys) {
        const timestamp = await redis.get(k)
        if (timestamp && typeof timestamp === 'number' && timestamp > windowStart) {
          used++
        }
      }
    }

    const remaining = Math.max(0, config.requests - used)
    const usagePercentage = (used / config.requests) * 100
    const resetAt = new Date(now + config.window * 1000)
    const resetInSeconds = Math.floor((resetAt.getTime() - now) / 1000)

    // Calculate prediction
    const prediction = await calculatePrediction(userId, type, used, config.requests, config.window)

    return {
      type,
      limit: config.requests,
      used,
      remaining,
      resetAt,
      resetInSeconds,
      usagePercentage,
      windowSeconds: config.window,
      prediction
    }
  } catch (error) {
    console.error(`Error getting rate limit status for ${type}:`, error)
    // Return fallback on error
    return {
      type,
      limit: config.requests,
      used: 0,
      remaining: config.requests,
      resetAt: new Date(Date.now() + config.window * 1000),
      resetInSeconds: config.window,
      usagePercentage: 0,
      windowSeconds: config.window,
      prediction: {
        willHitLimit: false,
        predictedTimeUntilLimit: null,
        predictedHitTime: null,
        currentRate: 0,
        averageRate: 0,
        confidence: 'low',
        recommendation: 'Error fetching data - using fallback'
      }
    }
  }
}

/**
 * Get all rate limit statuses for a user
 */
export async function getAllRateLimitStatuses(
  userId: string
): Promise<Record<RateLimitType, RateLimitStatus | null>> {
  const statuses: Record<string, RateLimitStatus | null> = {}
  
  const types = Object.keys(RATE_LIMITS) as RateLimitType[]
  
  await Promise.all(
    types.map(async (type) => {
      statuses[type] = await getRateLimitStatus(userId, type)
    })
  )
  
  return statuses as Record<RateLimitType, RateLimitStatus | null>
}

/**
 * Calculate prediction for when rate limit will be hit
 */
async function calculatePrediction(
  userId: string,
  type: RateLimitType,
  currentUsage: number,
  limit: number,
  windowSeconds: number
): Promise<RateLimitPrediction> {
  // Get usage history
  const historyKey = `${userId}:${type}`
  let history = usageHistory.get(historyKey) || []
  
  // Add current usage to history
  const now = Date.now()
  history.push({ timestamp: now, count: currentUsage })
  
  // Keep only last 10 data points
  if (history.length > 10) {
    history = history.slice(-10)
  }
  usageHistory.set(historyKey, history)

  // Not enough data for prediction
  if (history.length < 2) {
    return {
      willHitLimit: false,
      predictedTimeUntilLimit: null,
      predictedHitTime: null,
      currentRate: 0,
      averageRate: 0,
      confidence: 'low',
      recommendation: 'Collecting usage data...'
    }
  }

  // Already at or over limit
  if (currentUsage >= limit) {
    const resetTime = new Date(now + windowSeconds * 1000)
    return {
      willHitLimit: true,
      predictedTimeUntilLimit: 0,
      predictedHitTime: new Date(),
      currentRate: 0,
      averageRate: 0,
      confidence: 'high',
      recommendation: `Rate limit reached. Resets at ${resetTime.toLocaleString()}`
    }
  }

  // Calculate average rate (requests per second)
  const timeSpan = (history[history.length - 1].timestamp - history[0].timestamp) / 1000
  const usageGrowth = history[history.length - 1].count - history[0].count
  const averageRate = usageGrowth / timeSpan

  // Calculate current rate (last 2 data points)
  const recentTimeSpan = (history[history.length - 1].timestamp - history[history.length - 2].timestamp) / 1000
  const recentGrowth = history[history.length - 1].count - history[history.length - 2].count
  const currentRate = recentGrowth / recentTimeSpan

  // Predict when we'll hit the limit
  const remainingRequests = limit - currentUsage
  const effectiveRate = Math.max(currentRate, averageRate)

  let willHitLimit = false
  let predictedTimeUntilLimit: number | null = null
  let predictedHitTime: Date | null = null
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let recommendation = 'Continue normal usage'

  if (effectiveRate > 0) {
    predictedTimeUntilLimit = Math.floor(remainingRequests / effectiveRate)
    predictedHitTime = new Date(now + predictedTimeUntilLimit * 1000)

    // Will we hit limit before window resets?
    if (predictedTimeUntilLimit < windowSeconds) {
      willHitLimit = true
      
      // Determine confidence based on data consistency
      const rateVariance = Math.abs(currentRate - averageRate) / averageRate
      if (rateVariance < 0.2) {
        confidence = 'high'
      } else if (rateVariance < 0.5) {
        confidence = 'medium'
      } else {
        confidence = 'low'
      }

      // Generate recommendation
      const percentageUsed = (currentUsage / limit) * 100
      const timeUntilReset = windowSeconds
      
      if (percentageUsed > 90) {
        recommendation = '⚠️ Critical: Slow down requests immediately'
      } else if (percentageUsed > 75) {
        recommendation = '⚡ Warning: Approaching limit, reduce usage'
      } else if (predictedTimeUntilLimit < timeUntilReset * 0.3) {
        recommendation = '📊 Moderate usage - monitor closely'
      } else {
        recommendation = '✅ Usage is healthy'
      }
    }
  }

  return {
    willHitLimit,
    predictedTimeUntilLimit,
    predictedHitTime,
    currentRate,
    averageRate,
    confidence,
    recommendation
  }
}

/**
 * Track auto-reply rate limit (stored in memory by scheduler)
 */
export async function getAutoReplyRateLimit(
  userId: string
): Promise<RateLimitStatus | null> {
  try {
    const { prisma } = await import('@/lib/prisma')
    
    // Get user's auto-reply settings
    const settings = await prisma.autoReplySettings.findFirst({
      where: {
        userId,
        platform: 'threads'
      }
    })

    if (!settings) {
      return null
    }

    const limit = settings.maxRepliesPerHour
    
    // Count replies in last hour
    const oneHourAgo = new Date(Date.now() - 3600000)
    const repliesInLastHour = await prisma.replyHistory.count({
      where: {
        userId,
        repliedAt: {
          gte: oneHourAgo
        },
        status: 'replied'
      }
    })

    const remaining = Math.max(0, limit - repliesInLastHour)
    const usagePercentage = (repliesInLastHour / limit) * 100
    
    // Find next reset time (top of next hour)
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    const resetInSeconds = Math.floor((nextHour.getTime() - now.getTime()) / 1000)

    // Get prediction based on recent reply rate
    const prediction = await calculateAutoReplyPrediction(
      userId,
      repliesInLastHour,
      limit,
      3600 // 1 hour in seconds
    )

    return {
      type: 'autoReply',
      limit,
      used: repliesInLastHour,
      remaining,
      resetAt: nextHour,
      resetInSeconds,
      usagePercentage,
      windowSeconds: 3600,
      prediction
    }
  } catch (error) {
    console.error('Error getting auto-reply rate limit:', error)
    return null
  }
}

async function calculateAutoReplyPrediction(
  userId: string,
  currentUsage: number,
  limit: number,
  windowSeconds: number
): Promise<RateLimitPrediction> {
  try {
    const { prisma } = await import('@/lib/prisma')
    
    // Get reply history for prediction
    const thirtyMinutesAgo = new Date(Date.now() - 1800000) // 30 min
    const recentReplies = await prisma.replyHistory.count({
      where: {
        userId,
        repliedAt: {
          gte: thirtyMinutesAgo
        },
        status: 'replied'
      }
    })

    // Calculate rate (replies per second)
    const recentRate = recentReplies / 1800 // 30 minutes = 1800 seconds
    const averageRate = currentUsage / windowSeconds

    // Already at limit?
    if (currentUsage >= limit) {
      const now = new Date()
      const nextHour = new Date(now)
      nextHour.setHours(now.getHours() + 1, 0, 0, 0)
      
      return {
        willHitLimit: true,
        predictedTimeUntilLimit: 0,
        predictedHitTime: new Date(),
        currentRate: recentRate,
        averageRate,
        confidence: 'high',
        recommendation: `Auto-reply limit reached. Resets at ${nextHour.toLocaleTimeString()}`
      }
    }

    // Predict based on recent rate
    const remainingReplies = limit - currentUsage
    const effectiveRate = Math.max(recentRate, averageRate)

    if (effectiveRate > 0) {
      const predictedTimeUntilLimit = Math.floor(remainingReplies / effectiveRate)
      const predictedHitTime = new Date(Date.now() + predictedTimeUntilLimit * 1000)
      
      const willHitLimit = predictedTimeUntilLimit < windowSeconds
      const percentageUsed = (currentUsage / limit) * 100

      let recommendation = '✅ Auto-reply usage is healthy'
      let confidence: 'high' | 'medium' | 'low' = 'medium'

      if (percentageUsed > 90) {
        recommendation = '⚠️ Critical: Auto-reply limit almost reached'
        confidence = 'high'
      } else if (percentageUsed > 75) {
        recommendation = '⚡ Warning: Approaching auto-reply limit'
        confidence = 'high'
      } else if (willHitLimit) {
        recommendation = '📊 Moderate auto-reply activity'
        confidence = 'medium'
      }

      return {
        willHitLimit,
        predictedTimeUntilLimit,
        predictedHitTime,
        currentRate: recentRate,
        averageRate,
        confidence,
        recommendation
      }
    }

    return {
      willHitLimit: false,
      predictedTimeUntilLimit: null,
      predictedHitTime: null,
      currentRate: recentRate,
      averageRate,
      confidence: 'low',
      recommendation: 'Continue monitoring auto-reply usage'
    }
  } catch (error) {
    console.error('Error calculating auto-reply prediction:', error)
    return {
      willHitLimit: false,
      predictedTimeUntilLimit: null,
      predictedHitTime: null,
      currentRate: 0,
      averageRate: 0,
      confidence: 'low',
      recommendation: 'Error calculating prediction'
    }
  }
}

/**
 * Format time until reset in human-readable format
 */
export function formatTimeUntilReset(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

/**
 * Get severity level based on usage percentage
 */
export function getSeverityLevel(usagePercentage: number): 'success' | 'warning' | 'error' {
  if (usagePercentage < 70) return 'success'
  if (usagePercentage < 90) return 'warning'
  return 'error'
}
