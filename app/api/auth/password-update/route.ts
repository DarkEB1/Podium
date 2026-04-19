import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/supabase/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { password } = body as { password?: string }

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

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return NextResponse.json(
      { error: { code: 'PASSWORD_UPDATE_FAILED', message: error.message } },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
