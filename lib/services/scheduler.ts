import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@/lib/prisma'
import { publishThreadsPost } from '@/lib/api/threads'
import { publishInstagramPost, publishInstagramCarousel } from '@/lib/api/instagram'
import { decryptToken } from '@/lib/utils/encryption'
import { metricsCollector } from './scheduler-metrics'

let schedulerJob: ScheduledTask | null = null

// Initialize metrics
metricsCollector.initScheduler('post-scheduler')

// Track if scheduler was started in any instance
const SCHEDULER_FLAG_KEY = '__scheduler_running__'
if (typeof global !== 'undefined') {
  (global as any)[SCHEDULER_FLAG_KEY] = (global as any)[SCHEDULER_FLAG_KEY] || false
}

function setSchedulerRunning(running: boolean) {
  if (typeof global !== 'undefined') {
    (global as any)[SCHEDULER_FLAG_KEY] = running
  }
}

function isSchedulerRunning() {
  if (typeof global !== 'undefined') {
    return (global as any)[SCHEDULER_FLAG_KEY] === true
  }
  return false
}

export function startPostScheduler() {
  // Check global flag first
  if (isSchedulerRunning()) {
    console.log('⚠️ Post scheduler already running (global check)')
    return
  }

  if (schedulerJob) {
    console.log('⚠️ Post scheduler already running')
    return
  }

  // Run every minute
  schedulerJob = cron.schedule('* * * * *', async () => {
    const startTime = Date.now()
    let postsProcessed = 0
    let postsFailed = 0

    try {
      const now = new Date()
      console.log(`🔍 Checking for posts to publish at ${now.toISOString()}`)
      
      // Find posts that need to be published
      const postsToPublish = await prisma.post.findMany({
        where: {
          status: 'scheduled',
          scheduledAt: { lte: now }
        },
        include: {
          user: {
            include: {
              threadsAccounts: true,
              instagramAccounts: true
            }
          }
        }
      })

      console.log(`📝 Found ${postsToPublish.length} posts to publish`)

      for (const post of postsToPublish) {
        console.log(`📤 Processing post ${post.id}:`, {
          content: post.content.substring(0, 50) + '...',
          scheduledAt: post.scheduledAt,
          platform: post.platform,
          hasMedia: !!post.mediaUrls
        })
        try {
          let postId: string | null = null

          if (post.platform === 'threads') {
            const account = post.user.threadsAccounts[0]
            if (!account) {
              throw new Error('No Threads account connected')
            }

            const accessToken = decryptToken(account.accessToken)
            const mediaUrls = post.mediaUrls ? JSON.parse(post.mediaUrls) : []

            console.log('[Scheduler] Publishing post with:', {
              postId: post.id,
              contentLength: post.content.length,
              mediaCount: mediaUrls.length,
              topic: post.topic || 'none',
              location: post.location || 'none'
            })

            postId = await publishThreadsPost({
              accessToken,
              userId: account.threadsUserId,
              text: post.content,
              mediaUrls,
              topicTag: post.topic || undefined,
              linkAttachment: undefined // Can be added later if needed
            })

            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'published',
                publishedAt: new Date(),
                threadsPostId: postId
              }
            })

            postsProcessed++
            console.log(`✅ Published post ${post.id} to Threads`)
          } else if (post.platform === 'instagram') {
            const account = post.user.instagramAccounts[0]
            if (!account) {
              throw new Error('No Instagram account connected')
            }

            const accessToken = decryptToken(account.accessToken)
            const mediaUrls = post.mediaUrls ? JSON.parse(post.mediaUrls) : []

            if (mediaUrls.length === 0) {
              throw new Error('Instagram posts require at least one image')
            }

            console.log('[Scheduler] Publishing Instagram post with:', {
              postId: post.id,
              contentLength: post.content.length,
              mediaCount: mediaUrls.length
            })

            // Use carousel for multiple images, single post for one image
            if (mediaUrls.length > 1) {
              const result = await publishInstagramCarousel(
                account.instagramId,
                accessToken,
                {
                  caption: post.content,
                  imageUrls: mediaUrls
                }
              )
              postId = result.id
            } else {
              const result = await publishInstagramPost(
                account.instagramId,
                accessToken,
                {
                  caption: post.content,
                  imageUrl: mediaUrls[0]
                }
              )
              postId = result.id
            }

            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'published',
                publishedAt: new Date(),
                instagramPostId: postId
              }
            })

            postsProcessed++
            console.log(`✅ Published post ${post.id} to Instagram`)
          }
        } catch (error: any) {
          postsFailed++
          console.error(`❌ Failed to publish post ${post.id}:`, error)
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
          })
          
          await prisma.post.update({
            where: { id: post.id },
            data: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      }

      if (postsToPublish.length === 0) {
        console.log('✨ No posts to publish at this time')
      }

      // Record successful execution
      const executionTimeMs = Date.now() - startTime
      metricsCollector.recordExecution('post-scheduler', {
        success: true,
        itemsProcessed: postsProcessed,
        itemsFailed: postsFailed,
        executionTimeMs
      })
    } catch (error: any) {
      console.error('Post scheduler error:', error)
      
      // Record failed execution
      const executionTimeMs = Date.now() - startTime
      metricsCollector.recordExecution('post-scheduler', {
        success: false,
        itemsProcessed: postsProcessed,
        itemsFailed: postsFailed,
        executionTimeMs,
        error: error.message || 'Unknown error'
      })
    }
  })

  setSchedulerRunning(true)
  metricsCollector.setRunning('post-scheduler', true)
  console.log('📅 Post scheduler started - checking every minute')
}

export function stopPostScheduler() {
  if (schedulerJob) {
    schedulerJob.stop()
    schedulerJob = null
    setSchedulerRunning(false)
    metricsCollector.setRunning('post-scheduler', false)
    console.log('⏹️ Post scheduler stopped')
  }
}

export function getSchedulerStatus() {
  // Check both local and global state
  const localRunning = schedulerJob !== null
  const globalRunning = isSchedulerRunning()
  const metrics = metricsCollector.getMetrics('post-scheduler')
  const health = metricsCollector.getHealthStatus('post-scheduler')
  
  return {
    running: localRunning || globalRunning,
    metrics,
    health
  }
}

// Auto-start scheduler when this module is imported (for API routes)
// This ensures scheduler runs even if instrumentation doesn't load
if (typeof global !== 'undefined' && !isSchedulerRunning()) {
  console.log('🔄 Auto-starting scheduler from module import')
  startPostScheduler()
}
