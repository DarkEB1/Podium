import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondConnectionRequest, withdrawConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'

const VALID_ACTIONS = new Set(['accept', 'decline', 'withdraw'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const body = (await request.json()) as { action?: string }
  const { action } = body

  if (!action) {
    return NextResponse.json(
      { error: { code: 'MISSING_ACTION', message: 'action is required' } },
      { status: 400 }
    )
  }

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'action must be accept, decline, or withdraw' } },
      { status: 400 }
    )
  }

  const { requestId } = await params

  try {
    if (action === 'accept') {
      await respondConnectionRequest(supabase, requestId, user.id, true)
    } else if (action === 'decline') {
      await respondConnectionRequest(supabase, requestId, user.id, false)
    } else {
      await withdrawConnectionRequest(supabase, requestId, user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof DiscoveryError && err.code === 'REQUEST_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'REQUEST_NOT_FOUND', message: 'Connection request not found or not accessible' } },
        { status: 404 }
      )
    }
    throw err
  }
}
