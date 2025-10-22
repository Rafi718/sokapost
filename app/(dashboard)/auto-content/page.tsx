'use client'

import { useState, useEffect } from 'react'
import { FiSave, FiZap, FiTrash2, FiPlus, FiClock, FiEdit, FiEye } from 'react-icons/fi'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface AutoContentSetting {
  id: string
  topic: string
  tone: string
  language: string
  enabled: boolean
  cronTime: string
  timezone: string
  platform: string
  aiModel: string
  customPrompt: string | null
  autoPublish: boolean
  includeHashtags: boolean
  maxLength: number
  lastGeneratedAt: string | null
  totalGenerated: number
  createdAt: string
}

export default function AutoContentPage() {
  const [settings, setSettings] = useState<AutoContentSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    topic: '',
    tone: 'casual',
    language: 'id',
    enabled: false,
    cronTime: '0 8 * * *',
    timezone: 'Asia/Jakarta',
    platform: 'threads',
    aiModel: 'gemini-2.0-flash-lite',
    customPrompt: '',
    autoPublish: false,
    includeHashtags: true,
    maxLength: 500
  })

  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/auto-content/settings')
      setSettings(response.data)
    } catch (error: any) {
      console.error('Failed to fetch settings:', error)
      toast.error(error.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = editingId ? { ...formData, id: editingId } : formData

      await axios.post('/api/auto-content/settings', payload)
      
      toast.success(editingId ? 'Setting updated successfully!' : 'Setting created successfully!')
      
      // Reset form
      setShowForm(false)
      setEditingId(null)
      setFormData({
        topic: '',
        tone: 'casual',
        language: 'id',
        enabled: false,
        cronTime: '0 8 * * *',
        timezone: 'Asia/Jakarta',
        platform: 'threads',
        aiModel: 'gemini-2.0-flash-lite',
        customPrompt: '',
        autoPublish: false,
        includeHashtags: true,
        maxLength: 500
      })
      setPreviewContent('')
      
      // Refresh list
      fetchSettings()
    } catch (error: any) {
      console.error('Failed to save setting:', error)
      toast.error(error.response?.data?.error || 'Failed to save setting')
    }
  }

  const handleEdit = (setting: AutoContentSetting) => {
    setEditingId(setting.id)
    setFormData({
      topic: setting.topic,
      tone: setting.tone,
      language: setting.language,
      enabled: setting.enabled,
      cronTime: setting.cronTime,
      timezone: setting.timezone,
      platform: setting.platform,
      aiModel: setting.aiModel,
      customPrompt: setting.customPrompt || '',
      autoPublish: setting.autoPublish,
      includeHashtags: setting.includeHashtags,
      maxLength: setting.maxLength
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setting?')) return

    try {
      await axios.delete(`/api/auto-content/settings/${id}`)
      toast.success('Setting deleted successfully!')
      fetchSettings()
    } catch (error: any) {
      console.error('Failed to delete setting:', error)
      toast.error(error.response?.data?.error || 'Failed to delete setting')
    }
  }

  const handlePreview = async () => {
    try {
      setPreviewLoading(true)
      const response = await axios.post('/api/auto-content/preview', {
        topic: formData.topic,
        tone: formData.tone,
        language: formData.language,
        maxLength: formData.maxLength,
        includeHashtags: formData.includeHashtags,
        customPrompt: formData.customPrompt || null,
        platform: formData.platform
      })
      setPreviewContent(response.data.content)
      toast.success('Preview generated!')
    } catch (error: any) {
      console.error('Failed to preview:', error)
      toast.error(error.response?.data?.error || 'Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleTrigger = async (settingId: string) => {
    try {
      setTriggering(settingId)
      const response = await axios.post('/api/auto-content/trigger', { settingId })
      toast.success(`Content generated! Created ${response.data.posts.length} post(s)`)
      fetchSettings()
    } catch (error: any) {
      console.error('Failed to trigger:', error)
      toast.error(error.response?.data?.error || 'Failed to generate content')
    } finally {
      setTriggering(null)
    }
  }

  const parseCronToHumanReadable = (cronTime: string) => {
    const parts = cronTime.split(' ')
    if (parts.length !== 5) return cronTime

    const [minute, hour, day, month, dayOfWeek] = parts

    if (minute === '*' && hour === '*') return 'Every minute'
    if (day === '*' && month === '*' && dayOfWeek === '*') {
      return `Every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    }

    return cronTime
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
          <h1 className="text-3xl font-bold mb-2 text-gray-900">🤖 Auto Content Generator</h1>
          <p className="text-gray-600">
            AI akan otomatis membuat konten berdasarkan topik dan jadwal yang Anda tentukan
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData({
                topic: '',
                tone: 'casual',
                language: 'id',
                enabled: false,
                cronTime: '0 8 * * *',
                timezone: 'Asia/Jakarta',
                platform: 'threads',
                aiModel: 'gemini-2.0-flash-lite',
                customPrompt: '',
                autoPublish: false,
                includeHashtags: true,
                maxLength: 500
              })
              setPreviewContent('')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <FiPlus /> New Setting
          </button>

          <Link
            href="/auto-content/history"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <FiClock /> View History
          </Link>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              {editingId ? 'Edit Setting' : 'Create New Setting'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Topic */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., Tips Digital Marketing, Quotes Motivasi"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  required
                />
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tone */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Tone</label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="funny">Funny</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="id">Indonesian</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="threads">Threads</option>
                    <option value="instagram">Instagram</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {/* Schedule (Cron Time) */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Schedule (Cron) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.cronTime}
                    onChange={(e) => setFormData({ ...formData, cronTime: e.target.value })}
                    placeholder="0 8 * * *"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: minute hour day month dayOfWeek (e.g., "0 8 * * *" = daily at 08:00)
                  </p>
                </div>

                {/* Max Length */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Max Length</label>
                  <input
                    type="number"
                    value={formData.maxLength}
                    onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    min="100"
                    max="2000"
                  />
                </div>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Custom Prompt (Optional)</label>
                <textarea
                  value={formData.customPrompt}
                  onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  placeholder="Custom instructions for AI..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  rows={3}
                />
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Enabled</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.autoPublish}
                    onChange={(e) => setFormData({ ...formData, autoPublish: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Auto Publish</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.includeHashtags}
                    onChange={(e) => setFormData({ ...formData, includeHashtags: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Include Hashtags</span>
                </label>
              </div>

              {/* Preview */}
              {previewContent && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium mb-2 text-gray-900">Preview:</h3>
                  <p className="text-sm whitespace-pre-wrap text-gray-800">{previewContent}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <FiSave /> Save
                </button>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!formData.topic || previewLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  <FiEye /> {previewLoading ? 'Generating...' : 'Preview'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setPreviewContent('')
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Settings List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Settings</h2>

          {settings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              No settings yet. Create your first auto-content setting!
            </div>
          ) : (
            settings.map((setting) => (
              <div
                key={setting.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{setting.topic}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          setting.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {setting.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        {setting.platform}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Schedule:</strong> {parseCronToHumanReadable(setting.cronTime)}
                      </p>
                      <p>
                        <strong>Tone:</strong> {setting.tone} | <strong>Language:</strong>{' '}
                        {setting.language}
                      </p>
                      <p>
                        <strong>Auto Publish:</strong> {setting.autoPublish ? 'Yes' : 'No'} |{' '}
                        <strong>Hashtags:</strong> {setting.includeHashtags ? 'Yes' : 'No'}
                      </p>
                      <p>
                        <strong>Generated:</strong> {setting.totalGenerated} times
                        {setting.lastGeneratedAt && (
                          <span className="ml-2">
                            (Last: {new Date(setting.lastGeneratedAt).toLocaleString()})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTrigger(setting.id)}
                      disabled={triggering === setting.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                      title="Trigger Now"
                    >
                      <FiZap size={18} />
                    </button>

                    <button
                      onClick={() => handleEdit(setting)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <FiEdit size={18} />
                    </button>

                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
