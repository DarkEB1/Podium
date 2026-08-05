import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { disableTwoFactor, verifyTwoFactorLogin } from '@/lib/supabase/two-factor'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/**
 * Turn off the caller's 2FA and wipe the stored secret.
 *
 * SECURITY: a live session is NOT sufficient. Removing the second factor is the
 * first move a hijacked session makes, so this endpoint costs the same proof
 * /verify demands — a live TOTP code or a one-time recovery code — under the
 * same tight limit, because six digits are otherwise brute-forceable.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  const limited = await consume(userKey('account_2fa_disable', user.id), RATE_LIMITS.admin2faByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  let body: { token?: string }
  try {
    body = (await request.json()) as { token?: string }
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: { code: 'MISSING_TOKEN', message: 'A code is required' } }, { status: 400 })
  }

  const admin = createAdminClient()
  const ok = await verifyTwoFactorLogin(admin, user.id, token)
  if (!ok) {
    return NextResponse.json({ error: { code: 'INVALID_CODE', message: 'That code is not valid.' } }, { status: 401 })
  }

  await disableTwoFactor(admin, user.id)
  return NextResponse.json({ ok: true })
}
