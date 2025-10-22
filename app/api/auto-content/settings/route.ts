import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// GET - Get all auto-content settings for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.autoContentSettings.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Get auto-content settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get settings' },
      { status: 500 }
    )
  }
}

// POST - Create or update auto-content setting
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
      id,
      topic,
      tone,
      language,
      enabled,
      cronTime,
      timezone,
      platform,
      aiModel,
      customPrompt,
      autoPublish,
      includeHashtags,
      maxLength
    } = body

    // Validate required fields
    if (!topic || !cronTime || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, cronTime, platform' },
        { status: 400 }
      )
    }

    // Validate cron time format (basic validation)
    const cronParts = cronTime.split(' ')
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { error: 'Invalid cron time format. Use: minute hour day month dayOfWeek (e.g., "0 8 * * *")' },
        { status: 400 }
      )
    }

    // Validate platform
    if (!['threads', 'instagram', 'both'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be: threads, instagram, or both' },
        { status: 400 }
      )
    }

    // If updating existing setting
    if (id) {
      const setting = await prisma.autoContentSettings.update({
        where: {
          id,
          userId: session.user.id // Ensure user owns this setting
        },
        data: {
          topic,
          tone: tone || 'casual',
          language: language || 'id',
          enabled: enabled ?? false,
          cronTime,
          timezone: timezone || 'Asia/Jakarta',
          platform,
          aiModel: aiModel || 'gemini-2.0-flash-lite',
          customPrompt: customPrompt || null,
          autoPublish: autoPublish ?? false,
          includeHashtags: includeHashtags ?? true,
          maxLength: maxLength || 500
        }
      })

      return NextResponse.json(setting)
    }

    // Create new setting
    const setting = await prisma.autoContentSettings.create({
      data: {
        userId: session.user.id,
        topic,
        tone: tone || 'casual',
        language: language || 'id',
        enabled: enabled ?? false,
        cronTime,
        timezone: timezone || 'Asia/Jakarta',
        platform,
        aiModel: aiModel || 'gemini-2.0-flash-lite',
        customPrompt: customPrompt || null,
        autoPublish: autoPublish ?? false,
        includeHashtags: includeHashtags ?? true,
        maxLength: maxLength || 500
      }
    })

    return NextResponse.json(setting, { status: 201 })
  } catch (error: any) {
    console.error('Create/update auto-content setting error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save setting' },
      { status: 500 }
    )
  }
}
