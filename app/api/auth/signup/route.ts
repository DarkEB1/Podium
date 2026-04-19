import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/supabase/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
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
  await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?type=email_confirmation`,
    },
  })

  // Always return the same message — never reveal whether the email already exists
  return NextResponse.json({
    message: 'Check your email to verify your account',
  })
}
