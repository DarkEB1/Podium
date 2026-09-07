import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser, requestDeletion } from '@/lib/supabase/auth'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/**
 * WS-ACCT-01 — schedule the caller's own account for erasure.
 *
 * Wires the previously-dead "Delete my account" button to the GDPR grace-period
 * flow: `requestDeletion` sets `deletion_scheduled_at` 14 days out, which the
 * `process_scheduled_deletions` cron then acts on, and a later sign-in inside
 * the window cancels it (`cancelDeletionOnSignIn`).
 *
 * SECURITY: a live session is not sufficient. Deleting the account is the most
 * destructive thing a session can do, so — like `/api/account/2fa/disable` — it
 * re-verifies the current password first. Wrong password never touches the DB.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 }
    )
  }

  let body: { password?: string; current_password?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  const password = body.password ?? body.current_password
  if (!password) {
    return NextResponse.json(
      { error: { code: 'MISSING_PASSWORD', message: 'Enter your current password to confirm' } },
      { status: 400 }
    )
  }

  const limited = await consume(userKey('account_delete', user.id), RATE_LIMITS.reauthByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  if (!user.email) {
    return NextResponse.json(
      { error: { code: 'NO_EMAIL', message: 'This account cannot be verified for deletion.' } },
      { status: 400 }
    )
  }

  // Re-authenticate. A failed sign-in does not disturb the existing session.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (reauthError) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } },
      { status: 401 }
    )
  }

  await requestDeletion(supabase, user.id)

  // End the session so the browser is not left signed in to an account that is
  // now scheduled for erasure. Best-effort: the deletion is already recorded.
  try {
    await supabase.auth.signOut()
  } catch {
    /* the schedule is what matters; a sign-out hiccup must not fail the request */
  }

  return NextResponse.json({
    success: true,
    message: 'Your account is scheduled for deletion. Sign in within 14 days to cancel.',
  })
}
