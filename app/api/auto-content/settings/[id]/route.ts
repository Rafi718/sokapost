import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// DELETE - Delete auto-content setting
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if setting exists and belongs to user
    const setting = await prisma.autoContentSettings.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!setting) {
      return NextResponse.json(
        { error: 'Setting not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete the setting
    await prisma.autoContentSettings.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete auto-content setting error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete setting' },
      { status: 500 }
    )
  }
}
