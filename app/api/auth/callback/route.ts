import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Mark email as verified in public.users
  await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('id', data.session.user.id)

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/update-password`)
  }

  return NextResponse.redirect(`${origin}/role-select`)
}
