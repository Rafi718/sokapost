import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// GET - Get comment logs for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {
      userId: session.user.id
    }

    if (postId) {
      where.postId = postId
    }

    if (status) {
      where.status = status
    }

    const logs = await prisma.commentLog.findMany({
      where,
      orderBy: {
        attemptedAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json(logs)
  } catch (error: any) {
    console.error('Get comment logs error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get logs' },
      { status: 500 }
    )
  }
}
