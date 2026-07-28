import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { verifyTwoFactorLogin } from '@/lib/supabase/two-factor'
import { attachAdmin2faCookie } from '@/lib/auth/admin-2fa-response'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'

/** The user 2FA login challenge: verify a TOTP or recovery code and pass the session. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  const limited = await consume(userKey('account_2fa_verify', user.id), RATE_LIMITS.admin2faByUser)
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

  const res = NextResponse.json({ ok: true })
  return await attachAdmin2faCookie(res, user.id)
}
