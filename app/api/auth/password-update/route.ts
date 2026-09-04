import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/supabase/auth'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import {
  RECOVERY_COOKIE,
  isRecoveryCookieSet,
  clearRecoveryCookie,
} from '@/lib/auth/recovery-cookie'

/**
 * Sets a new password. Two callers, two flows, told apart by the recovery
 * cookie the auth callback sets after a reset-link exchange (WS-ACCT-04):
 *
 * - **Recovery flow** (cookie present): the user proved control of the account
 *   by following the emailed link, so no current password is asked. After the
 *   update the recovery marker is cleared and ALL sessions are signed out, so
 *   the reset link stops being a live login and the form's "Please sign in" copy
 *   is finally true.
 *
 * - **Logged-in change** (no cookie): the current password is re-verified first
 *   (WS-ACCT-03 — it was previously sent by the form and silently dropped, so a
 *   hijacked/unattended session could lock the owner out). Other sessions are
 *   then signed out; the current one stays live so settings keeps working.
 */
export async function POST(request: NextRequest) {
  let body: { password?: string; current_password?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  const { password, current_password: currentPassword } = body

  if (!password) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'Password is required' } },
      { status: 400 }
    )
  }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.valid) {
    return NextResponse.json(
      { error: { code: 'WEAK_PASSWORD', message: passwordCheck.error } },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No valid recovery session' } },
      { status: 401 }
    )
  }

  const inRecovery = isRecoveryCookieSet(request.cookies.get(RECOVERY_COOKIE)?.value)

  // Logged-in change: re-authenticate with the current password before allowing
  // the write. Skipped for a recovery-link session (the link WAS the proof).
  if (!inRecovery) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: { code: 'MISSING_CURRENT_PASSWORD', message: 'Enter your current password' } },
        { status: 400 }
      )
    }
    if (!user.email) {
      return NextResponse.json(
        { error: { code: 'NO_EMAIL', message: 'This account cannot be re-verified.' } },
        { status: 400 }
      )
    }
    const limited = await consume(userKey('password_reauth', user.id), RATE_LIMITS.reauthByUser)
    if (!limited.allowed) return tooManyRequests(limited.retryAfter)

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (reauthError) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } },
        { status: 401 }
      )
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return NextResponse.json(
      { error: { code: 'PASSWORD_UPDATE_FAILED', message: error.message } },
      { status: 400 }
    )
  }

  // Invalidate other sessions on any password change; a recovery reset also ends
  // the current (link-obtained) session so the user must sign in fresh.
  try {
    await supabase.auth.signOut({ scope: inRecovery ? 'global' : 'others' })
  } catch {
    /* the password is already changed; a sign-out hiccup must not fail it */
  }

  const response = NextResponse.json({ success: true })
  if (inRecovery) clearRecoveryCookie(response)
  return response
}
