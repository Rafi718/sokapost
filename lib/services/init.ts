import { startPostScheduler } from './scheduler'
import { startTokenRefreshJob } from './token-refresh'
import { startAutoReplyScheduler } from './auto-reply-scheduler'
import { startAutoContentGenerator } from './auto-content-generator'
import { startCommentPoster } from './comment-poster'

let initialized = false

export function initializeBackgroundJobs() {
  if (initialized) {
    console.log('⚠️ Background jobs already initialized')
    return
  }

  console.log('🚀 Initializing background jobs...')

  // Start post scheduler
  startPostScheduler()

  // Start token refresh job
  startTokenRefreshJob()

  // Start auto-reply scheduler
  startAutoReplyScheduler()

  // Start auto-content generator
  startAutoContentGenerator()

  // Start comment poster (for split content)
  startCommentPoster()

  initialized = true
  console.log('✅ Background jobs initialized')
}

export function shutdownBackgroundJobs() {
  const { stopPostScheduler } = require('./scheduler')
  const { stopTokenRefreshJob } = require('./token-refresh')
  const { stopAutoContentGenerator } = require('./auto-content-generator')
  const { stopCommentPoster } = require('./comment-poster')

  stopPostScheduler()
  stopTokenRefreshJob()
  stopAutoContentGenerator()
  stopCommentPoster()

  initialized = false
  console.log('🛑 Background jobs stopped')
}

// Graceful shutdown
process.on('SIGTERM', shutdownBackgroundJobs)
process.on('SIGINT', shutdownBackgroundJobs)
