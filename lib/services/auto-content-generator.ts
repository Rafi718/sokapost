import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/ai/content-generator'
import { metricsCollector } from './scheduler-metrics'
import { smartSplitText } from '@/lib/utils/text-splitter'
import { createThreadsCommentThread } from '@/lib/api/threads-comment'
import { decryptToken } from '@/lib/utils/encryption'

let autoContentJob: ScheduledTask | null = null

// Initialize metrics
metricsCollector.initScheduler('auto-content-generator')

// Track if scheduler was started in any instance
const SCHEDULER_FLAG_KEY = '__auto_content_running__'
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

// Parse cron expression to check if it should run now
function shouldRunNow(cronTime: string): boolean {
  try {
    const now = new Date()
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cronTime.split(' ')
    
    const currentMinute = now.getMinutes()
    const currentHour = now.getHours()
    const currentDay = now.getDate()
    const currentMonth = now.getMonth() + 1
    const currentDayOfWeek = now.getDay()

    // Check minute
    if (minute !== '*' && parseInt(minute) !== currentMinute) return false
    
    // Check hour
    if (hour !== '*' && parseInt(hour) !== currentHour) return false
    
    // Check day of month
    if (dayOfMonth !== '*' && parseInt(dayOfMonth) !== currentDay) return false
    
    // Check month
    if (month !== '*' && parseInt(month) !== currentMonth) return false
    
    // Check day of week
    if (dayOfWeek !== '*' && parseInt(dayOfWeek) !== currentDayOfWeek) return false

    return true
  } catch (error) {
    console.error('Error parsing cron time:', error)
    return false
  }
}

// Check if already generated today (to prevent duplicates)
function wasGeneratedToday(lastGeneratedAt: Date | null): boolean {
  if (!lastGeneratedAt) return false
  
  const now = new Date()
  const lastGen = new Date(lastGeneratedAt)
  
  return (
    lastGen.getDate() === now.getDate() &&
    lastGen.getMonth() === now.getMonth() &&
    lastGen.getFullYear() === now.getFullYear()
  )
}

async function generateAndPublishContent(settingId: string) {
  try {
    // Get setting
    const setting = await prisma.autoContentSettings.findUnique({
      where: { id: settingId },
      include: {
        user: {
          include: {
            threadsAccounts: true,
            instagramAccounts: true
          }
        }
      }
    })

    if (!setting) {
      console.log(`⚠️ Setting ${settingId} not found`)
      return
    }

    if (!setting.enabled) {
      console.log(`⚠️ Setting ${settingId} is disabled`)
      return
    }

    // Check if already generated today
    if (wasGeneratedToday(setting.lastGeneratedAt)) {
      console.log(`⏭️ Content already generated today for setting ${settingId}`)
      return
    }

    // Check if should run now based on cron time
    if (!shouldRunNow(setting.cronTime)) {
      console.log(`⏭️ Not time yet for setting ${settingId} (cron: ${setting.cronTime})`)
      return
    }

    console.log(`🤖 Generating content for setting ${settingId}...`)
    console.log(`Topic: ${setting.topic}, Platform: ${setting.platform}`)
    console.log(`AI Prompt: ${setting.customPrompt?.substring(0, 50)}...`)
    
    // Validate customPrompt
    if (!setting.customPrompt || !setting.customPrompt.trim()) {
      console.error(`❌ Setting ${settingId} has no AI Prompt - skipping`)
      return
    }

    // Generate content using AI with higher limit (will be split later)
    const fullContent = await generateContent({
      customPrompt: setting.customPrompt,
      tone: setting.tone,
      language: setting.language,
      maxLength: 2000, // Generate up to 2000 chars
      includeHashtags: setting.includeHashtags,
      platform: setting.platform
    })

    console.log(`✅ Content generated (${fullContent.length} chars)`)

    // Split content if needed (500 chars per part)
    const { parts } = smartSplitText(fullContent, setting.maxLength || 500)
    const mainContent = parts[0]
    const continuationParts = parts.slice(1)

    console.log(`📝 Content split into ${parts.length} part(s)`)

    // Determine platforms to publish
    const platforms = setting.platform === 'both' ? ['threads', 'instagram'] : [setting.platform]

    for (const platform of platforms) {
      // Check if user has connected account for this platform
      if (platform === 'threads' && setting.user.threadsAccounts.length === 0) {
        console.log(`⚠️ User ${setting.userId} has no Threads account connected`)
        continue
      }
      if (platform === 'instagram' && setting.user.instagramAccounts.length === 0) {
        console.log(`⚠️ User ${setting.userId} has no Instagram account connected`)
        continue
      }

      // Create main post with first part
      const post = await prisma.post.create({
        data: {
          userId: setting.userId,
          content: mainContent,
          platform: platform,
          status: setting.autoPublish ? 'scheduled' : 'draft',
          scheduledAt: setting.autoPublish ? new Date() : null,
          topic: setting.topic,
          // Store continuation parts in DB for later processing
          continuationParts: continuationParts.length > 0 
            ? JSON.stringify(continuationParts) 
            : null,
          commentsPosted: false
        }
      })

      console.log(`📝 Post created: ${post.id} (${platform}, status: ${post.status})`)
      
      if (continuationParts.length > 0) {
        console.log(`💬 ${continuationParts.length} continuation parts stored, will be posted after publish`)
      }

      // Create history entry with full content
      await prisma.autoContentHistory.create({
        data: {
          userId: setting.userId,
          settingId: setting.id,
          topic: setting.topic,
          generatedContent: fullContent, // Store full content in history
          aiModel: setting.aiModel,
          postId: post.id,
          status: setting.autoPublish ? 'published' : 'generated'
        }
      })
    }

    // Update setting stats
    await prisma.autoContentSettings.update({
      where: { id: settingId },
      data: {
        lastGeneratedAt: new Date(),
        totalGenerated: { increment: 1 }
      }
    })

    console.log(`✅ Auto-content generation completed for setting ${settingId}`)
  } catch (error: any) {
    console.error(`❌ Failed to generate content for setting ${settingId}:`, error)

    // Log to history with error
    try {
      const setting = await prisma.autoContentSettings.findUnique({
        where: { id: settingId }
      })

      if (setting) {
        await prisma.autoContentHistory.create({
          data: {
            userId: setting.userId,
            settingId: setting.id,
            topic: setting.topic,
            generatedContent: '',
            aiModel: setting.aiModel,
            status: 'failed',
            errorMessage: error.message || 'Unknown error'
          }
        })
      }
    } catch (historyError) {
      console.error('Failed to log error to history:', historyError)
    }

    throw error
  }
}

export function startAutoContentGenerator() {
  // Check global flag first
  if (isSchedulerRunning()) {
    console.log('⚠️ Auto-content generator already running (global check)')
    return
  }

  if (autoContentJob) {
    console.log('⚠️ Auto-content generator already running')
    return
  }

  // Run every minute to check for settings that should generate content
  autoContentJob = cron.schedule('* * * * *', async () => {
    const startTime = Date.now()
    let settingsProcessed = 0
    let settingsFailed = 0

    try {
      console.log(`🤖 [Auto-Content] Checking for content to generate...`)

      // Find all enabled settings
      const settings = await prisma.autoContentSettings.findMany({
        where: {
          enabled: true
        }
      })

      console.log(`📋 Found ${settings.length} enabled auto-content settings`)

      for (const setting of settings) {
        try {
          await generateAndPublishContent(setting.id)
          settingsProcessed++
        } catch (error) {
          settingsFailed++
          console.error(`❌ Failed to process setting ${setting.id}:`, error)
        }
      }

      if (settings.length === 0) {
        console.log('✨ No auto-content settings enabled')
      }

      // Record successful execution
      const executionTimeMs = Date.now() - startTime
      metricsCollector.recordExecution('auto-content-generator', {
        success: true,
        itemsProcessed: settingsProcessed,
        itemsFailed: settingsFailed,
        executionTimeMs
      })
    } catch (error: any) {
      console.error('❌ Auto-content generator error:', error)

      // Record failed execution
      const executionTimeMs = Date.now() - startTime
      metricsCollector.recordExecution('auto-content-generator', {
        success: false,
        itemsProcessed: settingsProcessed,
        itemsFailed: settingsFailed,
        executionTimeMs,
        error: error.message || 'Unknown error'
      })
    }
  })

  setSchedulerRunning(true)
  metricsCollector.setRunning('auto-content-generator', true)
  console.log('🤖 Auto-content generator started - checking every minute')
}

export function stopAutoContentGenerator() {
  if (autoContentJob) {
    autoContentJob.stop()
    autoContentJob = null
    setSchedulerRunning(false)
    metricsCollector.setRunning('auto-content-generator', false)
    console.log('⏹️ Auto-content generator stopped')
  }
}

export function getAutoContentGeneratorStatus() {
  // Check both local and global state
  const localRunning = autoContentJob !== null
  const globalRunning = isSchedulerRunning()
  const metrics = metricsCollector.getMetrics('auto-content-generator')
  const health = metricsCollector.getHealthStatus('auto-content-generator')
  
  return {
    running: localRunning || globalRunning,
    metrics,
    health
  }
}

// Auto-start generator when this module is imported
if (typeof global !== 'undefined' && !isSchedulerRunning()) {
  console.log('🔄 Auto-starting content generator from module import')
  startAutoContentGenerator()
}
