import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { beginEnrollment } from '@/lib/supabase/two-factor'

/**
 * Start admin 2FA enrollment: mint a pending secret and return the otpauth URL
 * and manual key for the admin to add to their authenticator (2.4). Admin only.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admins only' } }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const { secret, otpauthUrl } = await beginEnrollment(admin, user.id, user.email)
    return NextResponse.json({ secret, otpauthUrl })
  } catch (err) {
    // A missing TWO_FACTOR_ENCRYPTION_KEY surfaces here as a clear 500.
    const message = err instanceof Error ? err.message : 'Could not start 2FA setup'
    return NextResponse.json({ error: { code: 'ENROLL_FAILED', message } }, { status: 500 })
  }
}
