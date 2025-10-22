import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// GET - Get auto-content generation history
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const settingId = searchParams.get('settingId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    const where: any = {
      userId: session.user.id
    }

    if (settingId) {
      where.settingId = settingId
    }

    if (status) {
      where.status = status
    }

    const history = await prisma.autoContentHistory.findMany({
      where,
      orderBy: {
        generatedAt: 'desc'
      },
      take: limit,
      include: {
        // Optionally include post data if needed
        // Note: We don't have relation in schema yet, so using manual lookup
      }
    })

    // Get post details if postId exists
    const historyWithPosts = await Promise.all(
      history.map(async (h) => {
        if (h.postId) {
          const post = await prisma.post.findUnique({
            where: { id: h.postId },
            select: {
              id: true,
              status: true,
              publishedAt: true,
              platform: true
            }
          })
          return { ...h, post }
        }
        return h
      })
    )

    return NextResponse.json(historyWithPosts)
  } catch (error: any) {
    console.error('Get auto-content history error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get history' },
      { status: 500 }
    )
  }
}
