import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { generateContent } from '@/lib/ai/content-generator'

// POST - Preview AI-generated content without saving
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      topic,
      tone,
      language,
      maxLength,
      includeHashtags,
      customPrompt,
      platform
    } = body

    // Validate required fields
    if (!topic || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, platform' },
        { status: 400 }
      )
    }

    console.log(`🔍 Previewing content for topic: ${topic}`)

    // Generate content using AI
    const content = await generateContent({
      topic,
      tone: tone || 'casual',
      language: language || 'id',
      maxLength: maxLength || 500,
      includeHashtags: includeHashtags ?? true,
      customPrompt: customPrompt || null,
      platform
    })

    return NextResponse.json({
      success: true,
      content,
      metadata: {
        length: content.length,
        topic,
        tone: tone || 'casual',
        platform
      }
    })
  } catch (error: any) {
    console.error('Preview content error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview' },
      { status: 500 }
    )
  }
}
