import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/**
 * WS-ACCT-02 — change the caller's sign-in email.
 *
 * The settings form posted here already; the route simply never existed, so the
 * form showed "not available yet" on the 404. It calls
 * `supabase.auth.updateUser({ email })`, which — with the project's "Secure
 * email change" setting on — sends a confirmation to BOTH the old and the new
 * address (the double confirmation), and only swaps the address once the new one
 * is confirmed via the auth callback.
 *
 * A plain, well-known RFC-5322-ish check plus the 254-char RFC-5321 cap; GoTrue
 * does the authoritative validation.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 }
    )
  }

  let body: { email?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: { code: 'INVALID_EMAIL', message: 'Enter a valid email address' } },
      { status: 400 }
    )
  }

  if (email === user.email?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: { code: 'SAME_EMAIL', message: 'That is already your email address' } },
      { status: 400 }
    )
  }

  const limited = await consume(userKey('account_email', user.id), RATE_LIMITS.reauthByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?type=email_change` }
  )

  if (error) {
    console.error('[account/email] updateUser failed', error.message)
    return NextResponse.json(
      {
        error: {
          code: 'EMAIL_UPDATE_FAILED',
          message: 'We could not start the email change. Please try again shortly.',
        },
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message:
      'Check both your current and new inboxes — confirm the change from each to finish updating your email.',
  })
}
