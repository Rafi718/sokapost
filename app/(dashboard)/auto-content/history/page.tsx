'use client'

import { useState, useEffect } from 'react'
import { FiArrowLeft, FiCheck, FiX, FiClock, FiExternalLink } from 'react-icons/fi'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Post {
  id: string
  status: string
  publishedAt: string | null
  platform: string
}

interface HistoryItem {
  id: string
  topic: string
  generatedContent: string
  aiModel: string
  postId: string | null
  status: string
  errorMessage: string | null
  generatedAt: string
  post?: Post
}

export default function AutoContentHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchHistory()
  }, [filter])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const response = await axios.get(`/api/auto-content/history${params}`)
      setHistory(response.data)
    } catch (error: any) {
      console.error('Failed to fetch history:', error)
      toast.error(error.response?.data?.error || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      generated: 'bg-blue-100 text-blue-700',
      published: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    }

    const icons = {
      generated: <FiClock size={14} />,
      published: <FiCheck size={14} />,
      failed: <FiX size={14} />
    }

    return (
      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/auto-content"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <FiArrowLeft /> Back to Settings
          </Link>

          <h1 className="text-3xl font-bold mb-2 text-gray-900">📜 Content Generation History</h1>
          <p className="text-gray-600">
            View all AI-generated content and their status
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('generated')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'generated'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Generated
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'published'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Published
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'failed'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Failed
          </button>
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No history found
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{item.topic}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(item.generatedAt).toLocaleString()}
                    </p>
                  </div>

                  {item.postId && (
                    <Link
                      href={`/posts`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      View Post <FiExternalLink size={14} />
                    </Link>
                  )}
                </div>

                {/* Generated Content */}
                <div className="mb-4">
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <p className="text-sm whitespace-pre-wrap text-gray-800">{item.generatedContent}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>AI Model: {item.aiModel}</span>
                  <span>Length: {item.generatedContent.length} chars</span>
                  {item.post && (
                    <>
                      <span>Platform: {item.post.platform}</span>
                      {item.post.publishedAt && (
                        <span>Published: {new Date(item.post.publishedAt).toLocaleString()}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Error Message */}
                {item.status === 'failed' && item.errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {item.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
