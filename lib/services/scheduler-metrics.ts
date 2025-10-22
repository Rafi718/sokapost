// Metrics tracking for scheduler health monitoring

export interface SchedulerMetrics {
  name: string
  running: boolean
  totalExecutions: number
  successCount: number
  failureCount: number
  lastExecutionTime: Date | null
  lastSuccessTime: Date | null
  lastFailureTime: Date | null
  lastError: string | null
  averageExecutionTimeMs: number
  itemsProcessed: number
  itemsFailed: number
}

export interface ExecutionResult {
  success: boolean
  itemsProcessed: number
  itemsFailed: number
  executionTimeMs: number
  error?: string
}

class MetricsCollector {
  private metrics: Map<string, SchedulerMetrics> = new Map()

  initScheduler(name: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        running: false,
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        lastExecutionTime: null,
        lastSuccessTime: null,
        lastFailureTime: null,
        lastError: null,
        averageExecutionTimeMs: 0,
        itemsProcessed: 0,
        itemsFailed: 0
      })
    }
  }

  setRunning(name: string, running: boolean) {
    const metric = this.metrics.get(name)
    if (metric) {
      metric.running = running
    }
  }

  recordExecution(name: string, result: ExecutionResult) {
    const metric = this.metrics.get(name)
    if (!metric) return

    metric.totalExecutions++
    metric.lastExecutionTime = new Date()
    metric.itemsProcessed += result.itemsProcessed
    metric.itemsFailed += result.itemsFailed

    if (result.success) {
      metric.successCount++
      metric.lastSuccessTime = new Date()
    } else {
      metric.failureCount++
      metric.lastFailureTime = new Date()
      metric.lastError = result.error || 'Unknown error'
    }

    // Update average execution time
    const prevAvg = metric.averageExecutionTimeMs
    const prevCount = metric.totalExecutions - 1
    metric.averageExecutionTimeMs = 
      (prevAvg * prevCount + result.executionTimeMs) / metric.totalExecutions
  }

  getMetrics(name: string): SchedulerMetrics | null {
    return this.metrics.get(name) || null
  }

  getAllMetrics(): SchedulerMetrics[] {
    return Array.from(this.metrics.values())
  }

  // Check if scheduler is healthy
  isHealthy(name: string): boolean {
    const metric = this.metrics.get(name)
    if (!metric) return false

    // Scheduler should be running
    if (!metric.running) return false

    // If never executed, it's healthy (just started)
    if (metric.totalExecutions === 0) return true

    // Check if last execution was recent (within 10 minutes)
    if (metric.lastExecutionTime) {
      const now = Date.now()
      const lastExec = metric.lastExecutionTime.getTime()
      const timeSinceLastExec = now - lastExec
      const TEN_MINUTES = 10 * 60 * 1000
      
      // If last execution was more than 10 minutes ago, might be stuck
      if (timeSinceLastExec > TEN_MINUTES) return false
    }

    // Check error rate (should be less than 50%)
    const errorRate = metric.failureCount / metric.totalExecutions
    if (errorRate > 0.5) return false

    return true
  }

  // Get health status with details
  getHealthStatus(name: string): {
    healthy: boolean
    issues: string[]
    lastExecution: string | null
    errorRate: number
  } {
    const metric = this.metrics.get(name)
    const issues: string[] = []

    if (!metric) {
      return {
        healthy: false,
        issues: ['Scheduler not initialized'],
        lastExecution: null,
        errorRate: 0
      }
    }

    if (!metric.running) {
      issues.push('Scheduler is not running')
    }

    if (metric.lastExecutionTime) {
      const now = Date.now()
      const lastExec = metric.lastExecutionTime.getTime()
      const timeSinceLastExec = now - lastExec
      const TEN_MINUTES = 10 * 60 * 1000
      
      if (timeSinceLastExec > TEN_MINUTES) {
        issues.push(`No execution in ${Math.floor(timeSinceLastExec / 60000)} minutes (might be stuck)`)
      }
    } else if (metric.totalExecutions > 0) {
      issues.push('No execution timestamp recorded')
    }

    const errorRate = metric.totalExecutions > 0 
      ? metric.failureCount / metric.totalExecutions 
      : 0

    if (errorRate > 0.5) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
    }

    if (metric.lastError) {
      issues.push(`Last error: ${metric.lastError}`)
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastExecution: metric.lastExecutionTime?.toISOString() || null,
      errorRate
    }
  }

  reset(name: string) {
    this.metrics.delete(name)
    this.initScheduler(name)
  }

  resetAll() {
    this.metrics.clear()
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector()

// Helper to track execution time
export async function trackExecution<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  let itemsProcessed = 0
  let itemsFailed = 0

  try {
    const result = await fn()
    
    // If result is an object with counts, use them
    if (typeof result === 'object' && result !== null) {
      const r = result as any
      if ('itemsProcessed' in r) itemsProcessed = r.itemsProcessed
      if ('itemsFailed' in r) itemsFailed = r.itemsFailed
    }

    const executionTimeMs = Date.now() - startTime
    metricsCollector.recordExecution(name, {
      success: true,
      itemsProcessed,
      itemsFailed,
      executionTimeMs
    })

    return result
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime
    metricsCollector.recordExecution(name, {
      success: false,
      itemsProcessed,
      itemsFailed,
      executionTimeMs,
      error: error.message || 'Unknown error'
    })

    throw error
  }
}
