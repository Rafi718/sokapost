import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-api'
import { getAutoReplySchedulerStatus } from '@/lib/services/auto-reply-scheduler'

// GET - Check scheduler status
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get detailed scheduler status with metrics
    const status = getAutoReplySchedulerStatus()
    
    return NextResponse.json({
      success: true,
      scheduler: {
        loaded: true,
        running: status.running,
        interval: status.interval,
        health: status.health,
        metrics: status.metrics,
        status: status.running 
          ? 'Scheduler is running in the background' 
          : 'Scheduler is stopped'
      },
      tip: 'Check server console logs for scheduler activity like: 🤖 [Auto-Reply] Starting job...'
    })

  } catch (error: any) {
    console.error('Scheduler status check error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check scheduler status' },
      { status: 500 }
    )
  }
}
