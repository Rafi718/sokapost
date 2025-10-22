import { NextResponse } from 'next/server'
import { metricsCollector } from '@/lib/services/scheduler-metrics'
import { getSchedulerStatus } from '@/lib/services/scheduler'
import { getAutoReplySchedulerStatus } from '@/lib/services/auto-reply-scheduler'

// GET - Health check endpoint for schedulers
// Returns comprehensive health status and metrics for monitoring
export async function GET() {
  try {
    // Get status and metrics for both schedulers
    const postSchedulerStatus = getSchedulerStatus()
    const autoReplySchedulerStatus = getAutoReplySchedulerStatus()

    // Get all metrics
    const allMetrics = metricsCollector.getAllMetrics()

    // Determine overall health
    const postSchedulerHealthy = metricsCollector.isHealthy('post-scheduler')
    const autoReplySchedulerHealthy = metricsCollector.isHealthy('auto-reply-scheduler')
    const overallHealthy = postSchedulerHealthy && autoReplySchedulerHealthy

    // Build response
    const healthStatus = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      schedulers: {
        postScheduler: {
          name: 'Post Scheduler',
          running: postSchedulerStatus.running,
          healthy: postSchedulerHealthy,
          health: postSchedulerStatus.health,
          metrics: postSchedulerStatus.metrics,
          description: 'Publishes scheduled social media posts'
        },
        autoReplyScheduler: {
          name: 'Auto-Reply Scheduler',
          running: autoReplySchedulerStatus.running,
          healthy: autoReplySchedulerHealthy,
          health: autoReplySchedulerStatus.health,
          metrics: autoReplySchedulerStatus.metrics,
          interval: autoReplySchedulerStatus.interval,
          description: 'Monitors and auto-replies to Threads comments'
        }
      },
      summary: {
        totalSchedulers: 2,
        healthySchedulers: [postSchedulerHealthy, autoReplySchedulerHealthy].filter(Boolean).length,
        runningSchedulers: [postSchedulerStatus.running, autoReplySchedulerStatus.running].filter(Boolean).length,
        allMetrics
      }
    }

    // Return appropriate status code
    const statusCode = overallHealthy ? 200 : 503

    return NextResponse.json(healthStatus, { status: statusCode })
  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message || 'Failed to check health'
      },
      { status: 500 }
    )
  }
}
