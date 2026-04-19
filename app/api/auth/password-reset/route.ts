import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email } = body as { email?: string }

  if (email) {
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
