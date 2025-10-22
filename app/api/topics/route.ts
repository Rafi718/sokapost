import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// GET - Get all topics for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const topics = await prisma.topicLibrary.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: [
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(topics)
  } catch (error: any) {
    console.error('Get topics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get topics' },
      { status: 500 }
    )
  }
}

// POST - Create new topic
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topic, category, description } = body

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    // Check if topic already exists for this user
    const existing = await prisma.topicLibrary.findFirst({
      where: {
        userId: session.user.id,
        topic: topic.trim()
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Topic already exists' },
        { status: 400 }
      )
    }

    const newTopic = await prisma.topicLibrary.create({
      data: {
        userId: session.user.id,
        topic: topic.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null
      }
    })

    return NextResponse.json(newTopic, { status: 201 })
  } catch (error: any) {
    console.error('Create topic error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create topic' },
      { status: 500 }
    )
  }
}

// DELETE - Delete topic
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Topic ID required' },
        { status: 400 }
      )
    }

    // Check if topic belongs to user
    const topic = await prisma.topicLibrary.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      )
    }

    await prisma.topicLibrary.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete topic error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete topic' },
      { status: 500 }
    )
  }
}
