import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/ai/content-generator'

// POST - Manual trigger content generation
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { settingId } = body

    if (!settingId) {
      return NextResponse.json(
        { error: 'Setting ID required' },
        { status: 400 }
      )
    }

    // Get setting
    const setting = await prisma.autoContentSettings.findFirst({
      where: {
        id: settingId,
        userId: session.user.id
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

    if (!setting) {
      return NextResponse.json(
        { error: 'Setting not found or unauthorized' },
        { status: 404 }
      )
    }

    console.log(`🤖 Manual trigger content generation for setting ${settingId}`)

    // Validate customPrompt
    if (!setting.customPrompt || !setting.customPrompt.trim()) {
      return NextResponse.json(
        { error: 'AI Prompt is required in setting' },
        { status: 400 }
      )
    }

    // Generate content using AI
    const content = await generateContent({
      customPrompt: setting.customPrompt,
      tone: setting.tone,
      language: setting.language,
      maxLength: setting.maxLength,
      includeHashtags: setting.includeHashtags,
      platform: setting.platform
    })

    // Determine platforms to publish
    const platforms = setting.platform === 'both' ? ['threads', 'instagram'] : [setting.platform]
    const createdPosts = []

    for (const platform of platforms) {
      // Check if user has connected account for this platform
      if (platform === 'threads' && setting.user.threadsAccounts.length === 0) {
        continue
      }
      if (platform === 'instagram' && setting.user.instagramAccounts.length === 0) {
        continue
      }

      // Create post
      const post = await prisma.post.create({
        data: {
          userId: setting.userId,
          content: content,
          platform: platform,
          status: setting.autoPublish ? 'scheduled' : 'draft',
          scheduledAt: setting.autoPublish ? new Date() : null,
          topic: setting.topic
        }
      })

      createdPosts.push(post)

      // Create history entry
      await prisma.autoContentHistory.create({
        data: {
          userId: setting.userId,
          settingId: setting.id,
          topic: setting.topic,
          generatedContent: content,
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

    return NextResponse.json({
      success: true,
      content,
      posts: createdPosts
    })
  } catch (error: any) {
    console.error('Manual trigger error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate content' },
      { status: 500 }
    )
  }
}
