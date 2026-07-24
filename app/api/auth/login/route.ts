import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
      { status: 400 }
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
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    )
  }

  // A successful sign-in clears the counters so earlier typos don't leave a
  // legitimate user near their limit.
  await Promise.all([reset(ipKey('login', ip)), reset(emailKey('login', email))])

  const user = await getUser(supabase)
  return NextResponse.json({ user })
}
