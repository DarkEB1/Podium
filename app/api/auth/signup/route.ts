import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword, acceptTerms } from '@/lib/supabase/auth'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'
import { RATE_LIMITS, clientIpFrom, consumeAll, ipKey, tooManyRequests } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password, termsVersion, privacyVersion } = body as {
    email?: string
    password?: string
    termsVersion?: string
    privacyVersion?: string
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
      { status: 400 }
    )
  }

  // RFC 5321 caps an address at 254 chars; anything longer is junk or abuse.
  if (email.length > 254) {
    return NextResponse.json(
      { error: { code: 'INVALID_EMAIL', message: 'Enter a valid email address' } },
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

  // CL-5: consent was never recorded — `acceptTerms()` existed but had no
  // caller, so users.terms_accepted_at was empty for every account on the
  // platform. The client must send the versions it actually displayed; a
  // mismatch means the user agreed to superseded copy.
  if (termsVersion !== TERMS_VERSION || privacyVersion !== PRIVACY_VERSION) {
    return NextResponse.json(
      {
        error: {
          code: 'POLICY_NOT_ACCEPTED',
          message: 'You must accept the current Terms of Service and Privacy Policy',
        },
      },
      { status: 400 }
    )
  }

  // DH-2/SEC-2: account-creation spam also drives the verification mailer.
  const limited = await consumeAll([
    { key: ipKey('signup', clientIpFrom(request.headers)), rule: RATE_LIMITS.signupByIp },
  ])
  if (!limited.allowed) {
    return tooManyRequests(limited.retryAfter)
  }

  const supabase = await createClient()
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?type=email_confirmation`,
    },
  })

  // The response stays generic (never reveal whether an email exists), but the
  // failure must be visible in logs — a silently dropped signUp error is how
  // "the verification email never arrived" went undiagnosed.
  if (signUpError) {
    console.error('[signup] supabase signUp failed', signUpError.code, signUpError.message)
  }

  // Record consent against the account. Best-effort: a failure here must not
  // reveal whether the email already existed, nor block a legitimate signup —
  // but it must be visible in logs, because an account with no consent record
  // is a compliance problem.
  if (data?.user) {
    try {
      await acceptTerms(supabase, data.user.id, TERMS_VERSION, PRIVACY_VERSION)
    } catch (err) {
      console.error('[signup] failed to record policy acceptance', err)
    }
  }

  // Always return the same message — never reveal whether the email already exists
  return NextResponse.json({
    message: 'Check your email to verify your account',
  })
}
