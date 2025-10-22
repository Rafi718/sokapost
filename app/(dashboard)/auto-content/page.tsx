'use client'

import { useState, useEffect } from 'react'
import { FiSave, FiZap, FiTrash2, FiPlus, FiClock, FiEdit, FiEye, FiChevronDown, FiChevronUp, FiX, FiInfo } from 'react-icons/fi'
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

  // Time picker state
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly'>('daily')
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('1') // Monday

  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [showFullPreview, setShowFullPreview] = useState(false)
  
  // Topic library
  const [topics, setTopics] = useState<Array<{ id: string; topic: string; category: string | null }>>([])
  const [showTopicManager, setShowTopicManager] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicCategory, setNewTopicCategory] = useState('')

  useEffect(() => {
    fetchSettings()
    fetchTopics()
  }, [])
  
  const fetchTopics = async () => {
    try {
      const response = await axios.get('/api/topics')
      setTopics(response.data)
    } catch (error) {
      console.error('Failed to fetch topics:', error)
    }
  }
  
  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return
    
    try {
      await axios.post('/api/topics', {
        topic: newTopicName.trim(),
        category: newTopicCategory.trim() || null
      })
      toast.success('Topic added!')
      setNewTopicName('')
      setNewTopicCategory('')
      fetchTopics()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add topic')
    }
  }
  
  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Delete this topic?')) return
    
    try {
      await axios.delete(`/api/topics?id=${id}`)
      toast.success('Topic deleted!')
      fetchTopics()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete topic')
    }
  }
  
  const handleSelectTopic = (topic: string) => {
    setFormData({ ...formData, topic })
  }

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
      // Convert time picker to cron format
      const cronTime = timeToCron(scheduleTime, scheduleFrequency, scheduleDayOfWeek)
      
      const payload = editingId 
        ? { ...formData, cronTime, id: editingId } 
        : { ...formData, cronTime }

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
      setScheduleTime('08:00')
      setScheduleFrequency('daily')
      setScheduleDayOfWeek('1')
      setPreviewContent('')
      
      // Refresh list
      fetchSettings()
    } catch (error: any) {
      console.error('Failed to save setting:', error)
      toast.error(error.response?.data?.error || 'Failed to save setting')
    }
  }

  // Convert cron to time picker format
  const cronToTime = (cronTime: string) => {
    const parts = cronTime.split(' ')
    if (parts.length >= 2) {
      const minute = parts[0].padStart(2, '0')
      const hour = parts[1].padStart(2, '0')
      return `${hour}:${minute}`
    }
    return '08:00'
  }

  // Convert cron to frequency
  const cronToFrequency = (cronTime: string): 'daily' | 'weekly' => {
    const parts = cronTime.split(' ')
    if (parts.length >= 5 && parts[4] !== '*') {
      return 'weekly'
    }
    return 'daily'
  }

  // Convert cron to day of week
  const cronToDayOfWeek = (cronTime: string) => {
    const parts = cronTime.split(' ')
    if (parts.length >= 5 && parts[4] !== '*') {
      return parts[4]
    }
    return '1'
  }

  // Convert time picker to cron format
  const timeToCron = (time: string, frequency: 'daily' | 'weekly', dayOfWeek: string) => {
    const [hour, minute] = time.split(':')
    if (frequency === 'daily') {
      return `${minute} ${hour} * * *`
    } else {
      return `${minute} ${hour} * * ${dayOfWeek}`
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
    
    // Parse cron to time picker values
    setScheduleTime(cronToTime(setting.cronTime))
    setScheduleFrequency(cronToFrequency(setting.cronTime))
    setScheduleDayOfWeek(cronToDayOfWeek(setting.cronTime))
    
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FiZap className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Auto Content Generator</h1>
              <p className="text-sm text-gray-500">Powered by AI</p>
            </div>
          </div>
          <p className="text-gray-600">
            AI akan otomatis membuat konten berdasarkan topik dan jadwal yang Anda tentukan
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
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
              setScheduleTime('08:00')
              setScheduleFrequency('daily')
              setScheduleDayOfWeek('1')
              setPreviewContent('')
              setShowFullPreview(false)
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
          >
            <FiPlus size={18} /> New Setting
          </button>

          <Link
            href="/auto-content/history"
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:shadow-md transition-all duration-200 border border-gray-200 font-medium"
          >
            <FiClock size={18} /> View History
          </Link>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? '✏️ Edit Setting' : '✨ Create New Setting'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setScheduleTime('08:00')
                  setScheduleFrequency('daily')
                  setScheduleDayOfWeek('1')
                  setPreviewContent('')
                  setShowFullPreview(false)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Topic with Library */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Topic <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTopicManager(!showTopicManager)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                  >
                    <FiPlus size={12} /> Manage Topics
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g., Tips Digital Marketing, Quotes Motivasi"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 transition-all"
                    required
                  />
                  
                  {/* Saved Topics Dropdown */}
                  {topics.length > 0 && formData.topic.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      <div className="p-2 text-xs text-gray-500 font-medium border-b">Saved Topics:</div>
                      {topics.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTopic(t.topic)}
                          className="w-full text-left px-4 py-2 hover:bg-purple-50 text-sm text-gray-800 transition-colors"
                        >
                          <div className="font-medium">{t.topic}</div>
                          {t.category && (
                            <div className="text-xs text-gray-500">{t.category}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Topic Manager Modal */}
                {showTopicManager && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-gray-900">Topic Library</h4>
                      <button
                        type="button"
                        onClick={() => setShowTopicManager(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <FiX size={18} />
                      </button>
                    </div>
                    
                    {/* Add New Topic */}
                    <div className="mb-3 space-y-2">
                      <input
                        type="text"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        placeholder="Topic name..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTopicCategory}
                          onChange={(e) => setNewTopicCategory(e.target.value)}
                          placeholder="Category (optional)"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                        />
                        <button
                          type="button"
                          onClick={handleAddTopic}
                          className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    
                    {/* Topic List */}
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {topics.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No saved topics yet</p>
                      ) : (
                        topics.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectTopic(t.topic)
                                setShowTopicManager(false)
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="text-sm font-medium text-gray-900">{t.topic}</div>
                              {t.category && (
                                <div className="text-xs text-gray-500">{t.category}</div>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTopic(t.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tone */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Tone</label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 transition-all"
                  >
                    <option value="casual">😊 Casual</option>
                    <option value="formal">👔 Formal</option>
                    <option value="funny">😄 Funny</option>
                    <option value="professional">💼 Professional</option>
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

                {/* Schedule Time */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Schedule Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Frequency</label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value as 'daily' | 'weekly')}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="daily">Every Day</option>
                    <option value="weekly">Every Week</option>
                  </select>
                </div>

                {/* Day of Week (only show if weekly) */}
                {scheduleFrequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Day of Week</label>
                    <select
                      value={scheduleDayOfWeek}
                      onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                )}

                {/* Max Length Per Part */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Max Length Per Part
                  </label>
                  <input
                    type="number"
                    value={formData.maxLength}
                    onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 transition-all"
                    min="300"
                    max="500"
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                    <FiInfo size={12} className="mt-0.5 flex-shrink-0" />
                    <span>AI generates up to 2000 chars. If longer, it will auto-split into multiple parts (main post + comments)</span>
                  </p>
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
                <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <FiEye className="text-purple-600" /> Preview
                    </h3>
                    <span className="text-xs text-gray-500">{previewContent.length} characters</span>
                  </div>
                  <div className="relative">
                    <div 
                      className={`text-sm whitespace-pre-wrap text-gray-800 leading-relaxed overflow-hidden transition-all duration-300 ${!showFullPreview && previewContent.length > 300 ? 'max-h-32' : 'max-h-none'}`}
                      style={!showFullPreview && previewContent.length > 300 ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 6,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      } : {}}
                    >
                      {previewContent}
                    </div>
                    {previewContent.length > 300 && (
                      <button
                        type="button"
                        onClick={() => setShowFullPreview(!showFullPreview)}
                        className="mt-3 text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1 transition-colors"
                      >
                        {showFullPreview ? (
                          <>Show Less <FiChevronUp size={16} /></>
                        ) : (
                          <>Show More <FiChevronDown size={16} /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
                >
                  <FiSave size={18} /> Save Setting
                </button>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!formData.topic || previewLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                >
                  {previewLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FiEye size={18} /> Preview
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setScheduleTime('08:00')
                    setScheduleFrequency('daily')
                    setScheduleDayOfWeek('1')
                    setPreviewContent('')
                    setShowFullPreview(false)
                  }}
                  className="px-6 py-3 bg-white text-gray-700 rounded-xl hover:bg-gray-50 border border-gray-200 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Settings List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Settings</h2>

          {settings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiZap className="text-gray-400" size={32} />
              </div>
              <p className="text-gray-500 text-lg mb-2">No settings yet</p>
              <p className="text-gray-400 text-sm">Create your first auto-content setting to get started!</p>
            </div>
          ) : (
            settings.map((setting) => (
              <div
                key={setting.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all duration-200"
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
                      className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl disabled:opacity-50 transition-all"
                      title="Trigger Now"
                    >
                      {triggering === setting.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent"></div>
                      ) : (
                        <FiZap size={18} />
                      )}
                    </button>

                    <button
                      onClick={() => handleEdit(setting)}
                      className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Edit"
                    >
                      <FiEdit size={18} />
                    </button>

                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
