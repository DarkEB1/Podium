import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { deleteMessage, MessagingError } from '@/lib/supabase/messaging'

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
