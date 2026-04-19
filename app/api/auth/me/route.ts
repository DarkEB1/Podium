import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    role_locked_at: user.role_locked_at,
    email_verified: user.email_verified,
    terms_accepted_at: user.terms_accepted_at,
    deactivated_at: user.deactivated_at,
    deletion_scheduled_at: user.deletion_scheduled_at,
  })
}
