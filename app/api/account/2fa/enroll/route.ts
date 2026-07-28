import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { beginEnrollment } from '@/lib/supabase/two-factor'

/** Start user 2FA enrollment: mint a pending secret and return the otpauth URL. */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { secret, otpauthUrl } = await beginEnrollment(admin, user.id, user.email)
    return NextResponse.json({ secret, otpauthUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start 2FA setup'
    return NextResponse.json({ error: { code: 'ENROLL_FAILED', message } }, { status: 500 })
  }
}
