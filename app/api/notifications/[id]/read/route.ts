import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { markRead, NotificationsError } from '@/lib/supabase/notifications'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  try {
    const notification = await markRead(adminSupabase, id, user.id)
    return NextResponse.json(notification)
  } catch (err) {
    if (err instanceof NotificationsError && err.code === 'NOTIFICATION_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' } },
        { status: 404 }
      )
    }
    throw err
  }
}
