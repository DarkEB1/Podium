import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { sendConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const body = (await request.json()) as { recipient_id?: string; message?: string }
  const { recipient_id, message } = body

  if (!recipient_id || !message) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'recipient_id and message are required' } },
      { status: 400 }
    )
  }

  try {
    const connectionRequest = await sendConnectionRequest(supabase, user.id, recipient_id, message)
    return NextResponse.json(connectionRequest, { status: 201 })
  } catch (err) {
    if (err instanceof DiscoveryError) {
      if (err.code === 'MESSAGE_TOO_LONG') {
        return NextResponse.json(
          { error: { code: 'MESSAGE_TOO_LONG', message: err.message } },
          { status: 400 }
        )
      }
      if (err.code === 'DUPLICATE_REQUEST') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_REQUEST', message: err.message } },
          { status: 409 }
        )
      }
    }
    throw err
  }
}
