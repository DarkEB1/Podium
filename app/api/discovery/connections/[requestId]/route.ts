import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondConnectionRequest, withdrawConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'
import { getIncomingConnectionRequests, type ConnectionRequestRow } from '@/lib/supabase/connections'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'

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
      // Capture the request row BEFORE accepting so we know who the original
      // sender is (respondConnectionRequest returns void, and the row is no
      // longer 'pending' afterwards). Best-effort: a read failure here must not
      // stop the accept, so it is guarded — the accept below is the source of
      // truth for success. See report: a getConnectionRequestById accessor (or
      // respondConnectionRequest returning the row) would remove this pre-read.
      const admin = createAdminClient()
      let target: ConnectionRequestRow | undefined
      try {
        const pending = await getIncomingConnectionRequests(admin, user.id, { status: 'pending' })
        target = pending.find((r) => r.id === requestId)
      } catch {
        target = undefined
      }

      await respondConnectionRequest(supabase, requestId, user.id, true)

      // Fire only after the accept has durably succeeded. Recipient of the email
      // is the ORIGINAL SENDER — they are the one waiting to hear back; the
      // accepter (current user) is the "other" party.
      if (target) {
        const names = await resolveDisplayNames(admin, [target.sender_id, user.id])
        await sendTransactionalEmail(admin, {
          event: 'connection_request_accepted',
          userId: target.sender_id,
          data: {
            recipientName: nameOf(names, target.sender_id),
            otherName: nameOf(names, user.id, FALLBACK_OTHER_NAME),
            url: absoluteUrl(ROUTES.dashboard),
          },
        })
      }
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
