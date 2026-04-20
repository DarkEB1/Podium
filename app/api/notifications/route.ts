import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getNotifications, createNotification, NotificationsError } from '@/lib/supabase/notifications'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    const notifications = await getNotifications(supabase, user.id)
    return NextResponse.json(notifications)
  } catch (err) {
    if (err instanceof NotificationsError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}

function verifyServiceRoleKey(token: string | null): boolean {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !serviceRoleKey) return false
  try {
    const tokenBuf = Buffer.from(token)
    const keyBuf = Buffer.from(serviceRoleKey)
    return tokenBuf.length === keyBuf.length && timingSafeEqual(tokenBuf, keyBuf)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!verifyServiceRoleKey(token)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Service role key required' } },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { user_id, event_type, channel, title, body: notifBody, metadata } = body

  if (!user_id || !event_type || !channel || !title || !notifBody) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'user_id, event_type, channel, title, and body are required' } },
      { status: 400 }
    )
  }

  try {
    const adminSupabase = createAdminClient()
    const notification = await createNotification(adminSupabase, {
      user_id,
      event_type,
      channel,
      title,
      body: notifBody,
      ...(metadata !== undefined ? { metadata } : {}),
    })
    return NextResponse.json(notification, { status: 201 })
  } catch (err) {
    if (err instanceof NotificationsError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}
