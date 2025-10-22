'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Zap,
  BarChart3
} from 'lucide-react'

interface RateLimitStatus {
  type: string
  limit: number
  used: number
  remaining: number
  resetAt: Date
  resetInSeconds: number
  resetAtFormatted: string
  resetInFormatted: string
  usagePercentage: number
  windowSeconds: number
  windowDescription: string
  description: string
  severity: 'success' | 'warning' | 'error'
  prediction?: {
    willHitLimit: boolean
    predictedTimeUntilLimit: number | null
    predictedHitTime: Date | null
    currentRate: number
    averageRate: number
    confidence: 'high' | 'medium' | 'low'
    recommendation: string
  }
}

interface RateLimitsResponse {
  success: boolean
  userId: string
  timestamp: string
  summary: {
    totalLimits: number
    critical: number
    warning: number
    healthy: number
    willHitLimitSoon: boolean
  }
  limits: Record<string, RateLimitStatus>
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function RateLimitsPage() {
  const { data, error, isLoading, mutate } = useSWR<RateLimitsResponse>(
    '/api/rate-limits',
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true
    }
  )

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    if (data) {
      setLastUpdate(new Date())
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load rate limit information. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  const limits = Object.entries(data.limits)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">Rate Limits</h1>
            <p className="text-gray-700 mt-3 text-lg">
              Monitor your API usage and predict when limits will be reached
            </p>
            <div className="text-sm text-gray-600 mt-2">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-semibold hover:scale-105"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="border-0 bg-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <CardContent className="pt-6">
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Total Limits
              </div>
              <div className="text-5xl font-bold text-gray-900">{data.summary.totalLimits}</div>
              <p className="text-sm text-gray-600 mt-2">
                Active rate limits
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-green-50 to-green-100 shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <CardContent className="pt-6">
              <div className="text-green-700 text-xs font-semibold uppercase tracking-wider mb-2">
                Healthy
              </div>
              <div className="flex items-center gap-3">
                <div className="text-5xl font-bold text-green-900">{data.summary.healthy}</div>
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-sm text-green-700 mt-2">
                Below 70% usage
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <CardContent className="pt-6">
              <div className="text-yellow-700 text-xs font-semibold uppercase tracking-wider mb-2">
                Warning
              </div>
              <div className="flex items-center gap-3">
                <div className="text-5xl font-bold text-yellow-900">{data.summary.warning}</div>
                <AlertTriangle className="h-10 w-10 text-yellow-600" />
              </div>
              <p className="text-sm text-yellow-700 mt-2">
                70-90% usage
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-red-50 to-red-100 shadow-lg hover:shadow-xl transition-all hover:scale-105">
            <CardContent className="pt-6">
              <div className="text-red-700 text-xs font-semibold uppercase tracking-wider mb-2">
                Critical
              </div>
              <div className="flex items-center gap-3">
                <div className="text-5xl font-bold text-red-900">{data.summary.critical}</div>
                <Zap className="h-10 w-10 text-red-600" />
              </div>
              <p className="text-sm text-red-700 mt-2">
                Above 90% usage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Overall Alert */}
        {data.summary.willHitLimitSoon && (
          <Alert variant="destructive" className="border-0 shadow-lg">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="font-bold text-base">Rate Limit Warning</AlertTitle>
            <AlertDescription className="text-sm font-medium">
              One or more rate limits are predicted to be reached soon. Review the details below.
            </AlertDescription>
          </Alert>
        )}

        {/* Rate Limit Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {limits.map(([type, limit]) => (
            <RateLimitCard key={type} type={type} limit={limit} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RateLimitCard({ type, limit }: { type: string; limit: RateLimitStatus }) {
  const severityStyles = {
    success: {
      bg: 'bg-gradient-to-br from-green-50 to-emerald-100',
      text: 'text-green-900',
      icon: 'text-green-600',
      badge: 'bg-green-100 text-green-800 border-0'
    },
    warning: {
      bg: 'bg-gradient-to-br from-yellow-50 to-amber-100',
      text: 'text-yellow-900',
      icon: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800 border-0'
    },
    error: {
      bg: 'bg-gradient-to-br from-red-50 to-rose-100',
      text: 'text-red-900',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-800 border-0'
    }
  }[limit.severity]

  const severityIcon = {
    success: <CheckCircle2 className={`h-7 w-7 ${severityStyles.icon}`} />,
    warning: <AlertTriangle className={`h-7 w-7 ${severityStyles.icon}`} />,
    error: <Zap className={`h-7 w-7 ${severityStyles.icon}`} />
  }[limit.severity]

  return (
    <Card className={`border-0 ${severityStyles.bg} shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02]`}>
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {severityIcon}
            <h3 className={`capitalize text-2xl font-bold ${severityStyles.text}`}>{type}</h3>
          </div>
          <Badge className={`text-xs font-semibold px-3 py-1 ${severityStyles.badge}`}>
            {limit.windowDescription}
          </Badge>
        </div>
        <p className={`text-sm ${severityStyles.text}`}>
          {limit.description}
        </p>
        {/* Usage Stats */}
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-sm">Usage</span>
          <span className="font-bold text-2xl text-gray-900">
            {limit.used} <span className="text-gray-500 text-lg">/ {limit.limit}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <Progress 
            value={limit.usagePercentage} 
            className="h-3 bg-white/50"
          />
          <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
            <span>{limit.usagePercentage.toFixed(1)}% used</span>
            <span>{limit.remaining} remaining</span>
          </div>
        </div>

        {/* Reset Time */}
        <div className="flex items-center gap-3 p-4 bg-white/60 rounded-xl">
          <Clock className="h-5 w-5 text-gray-700" />
          <div className="flex-1">
            <div className="font-bold text-base text-gray-900">
              {limit.resetInFormatted}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              Resets at {limit.resetAtFormatted}
            </div>
          </div>
        </div>

        {/* Prediction */}
        {limit.prediction && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <TrendingUp className="h-5 w-5 text-gray-700" />
              Prediction
              <Badge variant="outline" className="ml-auto text-xs font-semibold border-gray-300">
                {limit.prediction.confidence} confidence
              </Badge>
            </div>

            {limit.prediction.willHitLimit && limit.prediction.predictedTimeUntilLimit !== null && (
              <Alert className="border-0 bg-white/60 shadow-sm">
                <BarChart3 className="h-5 w-5" />
                <AlertTitle className="text-sm font-bold">Limit May Be Reached</AlertTitle>
                <AlertDescription className="text-sm font-medium">
                  In approximately {formatSeconds(limit.prediction.predictedTimeUntilLimit)}
                  {limit.prediction.predictedHitTime && (
                    <> at {new Date(limit.prediction.predictedHitTime).toLocaleTimeString()}</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/60 rounded-xl">
                <div className="text-gray-600 font-semibold text-xs uppercase tracking-wide">Current Rate</div>
                <div className="font-bold text-lg text-gray-900 mt-2">
                  {limit.prediction.currentRate.toFixed(4)} <span className="text-sm text-gray-600">req/s</span>
                </div>
              </div>
              <div className="p-4 bg-white/60 rounded-xl">
                <div className="text-gray-600 font-semibold text-xs uppercase tracking-wide">Average Rate</div>
                <div className="font-bold text-lg text-gray-900 mt-2">
                  {limit.prediction.averageRate.toFixed(4)} <span className="text-sm text-gray-600">req/s</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/60 rounded-xl">
              <div className="font-semibold text-sm text-gray-700 mb-2 uppercase tracking-wide">Recommendation</div>
              <div className="text-sm text-gray-900 leading-relaxed">
                {limit.prediction.recommendation}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `${minutes} min` : ''}`
  }
}
