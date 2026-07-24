import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  RATE_LIMITS,
  clientIpFrom,
  consumeAll,
  emailKey,
  ipKey,
  tooManyRequests,
} from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email } = body as { email?: string }

  // DH-2/SEC-2: unthrottled, this endpoint is a mail-bombing primitive — an
  // attacker can flood any victim's inbox with reset links.
  if (email) {
    const ip = clientIpFrom(request.headers)
    const limited = await consumeAll([
      { key: ipKey('password-reset', ip), rule: RATE_LIMITS.passwordResetByIp },
      { key: emailKey('password-reset', email), rule: RATE_LIMITS.passwordResetByEmail },
    ])
    if (!limited.allowed) {
      return tooManyRequests(limited.retryAfter)
    }

    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?type=recovery`,
    })
  }

  // Always return the same message — never reveal whether the email exists
  return NextResponse.json({
    message: 'If this email exists, you will receive a reset link',
  })
}
