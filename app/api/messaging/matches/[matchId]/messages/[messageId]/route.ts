import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { deleteMessage, MessagingError } from '@/lib/supabase/messaging'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string; messageId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: deletion is state-changing too — shares the messaging namespace.
  const limited = await consume(userKey('message_delete', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const { messageId } = await params

  try {
    await deleteMessage(supabase, messageId, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MessagingError && err.code === 'MESSAGE_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'MESSAGE_NOT_FOUND', message: err.message } },
        { status: 404 }
      )
    }
    throw err
  }
}
