import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { sendConnectionRequest, DiscoveryError } from '@/lib/supabase/discovery'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: state-changing writes are limited per authenticated user. Its own key
  // namespace, so a burst of connection requests cannot exhaust the budget for
  // messaging or proposals.
  const limited = await consume(userKey('connection_request', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  let body: { recipient_id?: string; message?: string }
  try {
    body = (await request.json()) as { recipient_id?: string; message?: string }
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }
  const { recipient_id, message } = body

  if (!recipient_id || !message) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'recipient_id and message are required' } },
      { status: 400 }
    )
  }

  // PR-19: previously any unmapped DiscoveryError (e.g. REQUEST_CREATE_FAILED,
  // which is exactly what the recipient-FK violation raised) was rethrown and
  // surfaced as an HTML 500 with no JSON body — the client's `res.json()` then
  // threw and the user saw nothing at all. Every failure now returns the
  // documented `{ error: { code, message } }` shape.
  const STATUS_BY_CODE: Record<string, number> = {
    MESSAGE_TOO_LONG: 400,
    MESSAGE_TOO_SHORT: 400,
    SELF_CONNECT: 400,
    DUPLICATE_REQUEST: 409,
  }

  try {
    const connectionRequest = await sendConnectionRequest(supabase, user.id, recipient_id, message)

    // Side effect (never blocks the created request from being returned): email
    // the recipient that a connection request landed. The email layer never
    // throws and is bounded, so a fire-after-success await is safe. Names go in
    // the template data only — never in logs or an idempotency key.
    const admin = createAdminClient()
    const names = await resolveDisplayNames(admin, [recipient_id, user.id])
    await sendTransactionalEmail(admin, {
      event: 'connection_request_received',
      userId: recipient_id,
      data: {
        recipientName: nameOf(names, recipient_id),
        senderName: nameOf(names, user.id, FALLBACK_OTHER_NAME),
        message,
        url: absoluteUrl(ROUTES.dashboard),
      },
    })

    return NextResponse.json(connectionRequest, { status: 201 })
  } catch (err) {
    if (err instanceof DiscoveryError) {
      const status = STATUS_BY_CODE[err.code]
      if (status) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
      }
      // Unexpected data-layer failure: log the detail server-side, return a
      // generic message so a DB error string never reaches the browser.
      console.error('[connections] send failed', err.code, err.message)
      return NextResponse.json(
        {
          error: {
            code: 'REQUEST_CREATE_FAILED',
            message: 'Could not send your request. Please try again.',
          },
        },
        { status: 500 }
      )
    }
    throw err
  }
}
