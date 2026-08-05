import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  RATE_LIMITS,
  clientIpFrom,
  consumeAll,
  emailKey,
  ipKey,
  reset,
  tooManyRequests,
} from '@/lib/rate-limit'
import { recordLogin, recordFailedLogin, findUserIdByEmail } from '@/lib/supabase/sessions'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
      { status: 400 }
    )
  }

  // Hard caps before any provider or store work: no real credential exceeds
  // these, so oversized payloads are refused without burning a hash attempt.
  if (email.length > 254 || password.length > 128) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    )
  }

  // DH-2/SEC-2: throttle before touching the auth provider. Limited on both
  // axes — per IP (one host spraying many accounts) and per email (many hosts
  // targeting one account). Either tripping refuses the request.
  const ip = clientIpFrom(request.headers)
  const limited = await consumeAll([
    { key: ipKey('login', ip), rule: RATE_LIMITS.loginByIp },
    { key: emailKey('login', email), rule: RATE_LIMITS.loginByEmail },
  ])
  if (!limited.allowed) {
    return tooManyRequests(limited.retryAfter)
  }

  const supabase = await createClient()
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password })

  const userAgent = request.headers.get('user-agent')

  if (error) {
    // Best-effort: attribute a failed attempt to the account if it exists, so a
    // user can see "someone tried to sign in". Never blocks or changes timing.
    try {
      const admin = createAdminClient()
      const failedUserId = await findUserIdByEmail(admin, email)
      if (failedUserId) await recordFailedLogin(admin, failedUserId, { ip, userAgent })
    } catch {
      /* recording must never affect the auth result */
    }
    // With email confirmations on, an unverified user is not a bad password —
    // telling them "invalid credentials" sends them to reset a password that
    // was never wrong.
    if (error.code === 'email_not_confirmed') {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_NOT_CONFIRMED',
            message: 'Please confirm your email address first. Check your inbox for the verification link.',
          },
        },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    )
  }

  // A successful sign-in clears the counters so earlier typos don't leave a
  // legitimate user near their limit.
  await Promise.all([reset(ipKey('login', ip)), reset(emailKey('login', email))])

  const user = await getUser(supabase)

  // Populate active_sessions + login_history. Best-effort side effect.
  if (user) {
    try {
      const admin = createAdminClient()
      await recordLogin(admin, user.id, {
        ip,
        userAgent,
        refreshToken: signIn.session?.refresh_token ?? null,
      })
    } catch {
      /* a logging hiccup must not fail the sign-in */
    }
  }

  return NextResponse.json({ user })
}
