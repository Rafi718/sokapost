import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@/lib/prisma'
import { createThreadsCommentThread } from '@/lib/api/threads-comment'
import { decryptToken } from '@/lib/utils/encryption'
import { metricsCollector } from './scheduler-metrics'

let commentPosterJob: ScheduledTask | null = null

// Initialize metrics
metricsCollector.initScheduler('comment-poster')

const SCHEDULER_FLAG_KEY = '__comment_poster_running__'
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

/**
 * Posts continuation comments for split content
 */
export function startCommentPoster() {
  if (isSchedulerRunning()) {
    console.log('⚠️ Comment poster already running (global check)')
    return
  }

  if (commentPosterJob) {
    console.log('⚠️ Comment poster already running')
    return
  }

  // Run every 2 minutes to check for posts needing comments
  commentPosterJob = cron.schedule('*/2 * * * *', async () => {
    const startTime = Date.now()
    let postsProcessed = 0
    let postsFailed = 0

    try {
      const now = new Date()
      console.log(`\n${'='.repeat(60)}`)
      console.log(`💬 [Comment Poster] Job started at ${now.toISOString()}`)
      console.log(`${'='.repeat(60)}`)

      // Find published posts with continuation parts that haven't been commented yet
      const postsNeedingComments = await prisma.post.findMany({
        where: {
          status: 'published',
          commentsPosted: false,
          continuationParts: {
            not: null
          },
          threadsPostId: {
            not: null
          },
          platform: 'threads', // Only for Threads platform
          publishedAt: {
            // Only posts published at least 30 seconds ago (give time to stabilize)
            lte: new Date(Date.now() - 30000)
          }
        },
        include: {
          user: {
            include: {
              threadsAccounts: true
            }
          }
        },
        take: 5 // Process max 5 posts per run to avoid rate limits
      })

      console.log(`📋 Found ${postsNeedingComments.length} posts needing comments`)
      
      if (postsNeedingComments.length > 0) {
        console.log(`\nPosts to process:`)
        postsNeedingComments.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.id} - "${p.topic}" (published ${p.publishedAt})`)
        })
      }

      for (const post of postsNeedingComments) {
        const startPostTime = Date.now()
        
        try {
          console.log(`\n📝 Processing post ${post.id}:`)
          console.log(`   Topic: ${post.topic}`)
          console.log(`   Published: ${post.publishedAt}`)
          console.log(`   Threads Post ID: ${post.threadsPostId}`)
          
          const account = post.user.threadsAccounts[0]
          if (!account) {
            console.log(`⚠️ No Threads account for post ${post.id}`)
            console.log(`   User ID: ${post.userId}`)
            continue
          }

          // Parse continuation parts
          const continuationParts = JSON.parse(post.continuationParts!)
          if (!Array.isArray(continuationParts) || continuationParts.length === 0) {
            console.log(`⚠️ Invalid continuation parts for post ${post.id}`)
            await prisma.post.update({
              where: { id: post.id },
              data: { commentsPosted: true } // Mark as done to skip it
            })
            continue
          }

          console.log(`💬 Posting ${continuationParts.length} comments for post ${post.id}`)
          console.log(`   Account: @${account.username}`)
          
          const accessToken = decryptToken(account.accessToken)
          const totalParts = continuationParts.length

          // Post comments one by one with logging (chained)
          const commentIds: string[] = []
          let currentReplyToId = post.threadsPostId! // Start with main post
          
          for (let i = 0; i < continuationParts.length; i++) {
            const commentText = continuationParts[i]
            const commentNum = i + 1
            
            // Create log entry - pending
            const logEntry = await prisma.commentLog.create({
              data: {
                postId: post.id,
                userId: post.userId,
                commentNumber: commentNum,
                totalComments: totalParts,
                commentText: commentText,
                status: 'pending'
              }
            })
            
            try {
              console.log(`   📤 Posting comment ${commentNum}/${totalParts}...`)
              console.log(`      Length: ${commentText.length} chars`)
              console.log(`      Reply to: ${currentReplyToId}`)
              
              // Post comment to Threads (chained)
              const { createThreadsComment } = await import('@/lib/api/threads-comment')
              const commentId = await createThreadsComment({
                accessToken,
                userId: account.threadsUserId,
                postId: currentReplyToId, // Reply to previous comment
                text: commentText
              })
              
              commentIds.push(commentId)
              
              // Update log - success
              await prisma.commentLog.update({
                where: { id: logEntry.id },
                data: {
                  status: 'success',
                  commentId: commentId,
                  succeededAt: new Date()
                }
              })
              
              console.log(`   ✅ Comment ${commentNum}/${totalParts} posted successfully`)
              console.log(`      Comment ID: ${commentId}`)
              
              // Update reply_to_id for next comment (chain)
              currentReplyToId = commentId
              
              // Delay between comments (except last one)
              if (i < continuationParts.length - 1) {
                console.log(`   ⏳ Waiting 3 seconds...`)
                await new Promise(resolve => setTimeout(resolve, 3000))
              }
            } catch (commentError: any) {
              console.error(`   ❌ Failed to post comment ${commentNum}/${totalParts}:`, commentError.message)
              
              // Update log - failed
              await prisma.commentLog.update({
                where: { id: logEntry.id },
                data: {
                  status: 'failed',
                  errorMessage: commentError.message || 'Unknown error'
                }
              })
              
              // STOP if one fails - can't continue chain
              console.error(`   ⛔ Stopping comment chain due to failure`)
              postsFailed++
              break
            }
          }

          console.log(`✅ Posted ${commentIds.length}/${totalParts} comments for post ${post.id}`)
          console.log(`   Duration: ${Date.now() - startPostTime}ms`)

          // Mark as done (even if some comments failed, we tried)
          await prisma.post.update({
            where: { id: post.id },
            data: { commentsPosted: true }
          })

          postsProcessed++
        } catch (error: any) {
          postsFailed++
          console.error(`❌ Failed to process post ${post.id}:`, error)
          console.error(`   Error: ${error.message}`)
          console.error(`   Stack: ${error.stack?.substring(0, 200)}`)
          
          // Don't mark as done on error, will retry next run
          // But if it's been more than 1 hour, give up
          if (post.publishedAt && Date.now() - new Date(post.publishedAt).getTime() > 3600000) {
            console.log(`⏭️ Giving up on post ${post.id} (too old - over 1 hour)`)
            await prisma.post.update({
              where: { id: post.id },
              data: { commentsPosted: true } // Mark as done to avoid infinite retries
            })
          }
        }
      }

      if (postsNeedingComments.length === 0) {
        console.log('\n✨ No posts needing comments at this time')
      }

      // Record successful execution
      const executionTimeMs = Date.now() - startTime
      
      console.log(`\n${'='.repeat(60)}`)
      console.log(`📊 [Comment Poster] Job Summary:`)
      console.log(`   Posts processed: ${postsProcessed}`)
      console.log(`   Posts failed: ${postsFailed}`)
      console.log(`   Duration: ${executionTimeMs}ms`)
      console.log(`   Status: SUCCESS`)
      console.log(`${'='.repeat(60)}\n`)
      
      metricsCollector.recordExecution('comment-poster', {
        success: true,
        itemsProcessed: postsProcessed,
        itemsFailed: postsFailed,
        executionTimeMs
      })
    } catch (error: any) {
      console.error(`\n❌ [Comment Poster] Job FAILED:`, error)
      console.error(`   Error: ${error.message}`)
      console.error(`   Stack: ${error.stack}`)

      // Record failed execution
      const executionTimeMs = Date.now() - startTime
      metricsCollector.recordExecution('comment-poster', {
        success: false,
        itemsProcessed: postsProcessed,
        itemsFailed: postsFailed,
        executionTimeMs,
        error: error.message || 'Unknown error'
      })
    }
  })

  setSchedulerRunning(true)
  metricsCollector.setRunning('comment-poster', true)
  console.log('💬 Comment poster started - checking every 2 minutes')
}

export function stopCommentPoster() {
  if (commentPosterJob) {
    commentPosterJob.stop()
    commentPosterJob = null
    setSchedulerRunning(false)
    metricsCollector.setRunning('comment-poster', false)
    console.log('⏹️ Comment poster stopped')
  }
}

export function getCommentPosterStatus() {
  const localRunning = commentPosterJob !== null
  const globalRunning = isSchedulerRunning()
  const metrics = metricsCollector.getMetrics('comment-poster')
  const health = metricsCollector.getHealthStatus('comment-poster')
  
  return {
    running: localRunning || globalRunning,
    metrics,
    health
  }
}

// Auto-start when module is imported
if (typeof global !== 'undefined' && !isSchedulerRunning()) {
  console.log('🔄 Auto-starting comment poster from module import')
  startCommentPoster()
}
