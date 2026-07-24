import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { unsubscribeFromAllEmail } from '@/lib/supabase/settings'
import { addSuppression, getUserEmail } from '@/lib/supabase/email'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { captureException } from '@/lib/observability'
import { ROUTES } from '@/lib/routes'

/**
 * One-click unsubscribe (CL-4).
 *
 * Reached from a mail client where the user is NOT signed in, so authorisation
 * comes entirely from the HMAC-signed token in the link (see
 * lib/email/unsubscribe.ts) — never from a session. A forged or tampered token
 * verifies to null and is refused.
 *
 * Two entry points, both required:
 *   - GET  — the user clicked the visible "Unsubscribe" link. We action it and
 *            redirect to a confirmation page.
 *   - POST — RFC 8058 List-Unsubscribe-Post one-click, fired by Gmail/Apple
 *            without loading a page. Must action on POST and return 200.
 *
 * Must be public in middleware (there is no session). The token IS the auth.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function applyUnsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false
  const claim = verifyUnsubscribeToken(token)
  if (!claim) return false

  const admin = createAdminClient()
  try {
    // Turn off email preferences (marketing + per-event) for this user.
    await unsubscribeFromAllEmail(admin, claim.userId)

    // Also add the address to the suppression list, so the choice holds even if
    // a later code path forgets to check preferences. Belt and braces — an
    // unsubscribe that only flips a flag is one bug away from still sending.
    const email = await getUserEmail(admin, claim.userId)
    if (email) {
      await addSuppression(admin, {
        email,
        reason: 'unsubscribe',
        userId: claim.userId,
        detail: `one-click:${claim.purpose}`,
      })
    }
    return true
  } catch (err) {
    captureException(err, { route: '/api/unsubscribe', stage: 'apply' })
    return false
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const ok = await applyUnsubscribe(token)
  const url = request.nextUrl.clone()
  url.pathname = ROUTES.unsubscribed
  url.search = ok ? '' : '?error=invalid'
  return NextResponse.redirect(url)
}

export async function POST(request: NextRequest) {
  // RFC 8058: action silently, 200 on success. The mail client shows its own
  // confirmation; there is no redirect target.
  const token = request.nextUrl.searchParams.get('token')
  const ok = await applyUnsubscribe(token)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
