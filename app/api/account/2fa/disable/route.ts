import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { disableTwoFactor } from '@/lib/supabase/two-factor'

/** Turn off the caller's 2FA and wipe the stored secret. */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  await disableTwoFactor(createAdminClient(), user.id)
  return NextResponse.json({ ok: true })
}
