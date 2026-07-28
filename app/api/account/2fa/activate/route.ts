import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { activateTwoFactor, TwoFactorError } from '@/lib/supabase/two-factor'
import { attachAdmin2faCookie } from '@/lib/auth/admin-2fa-response'

/** Confirm the first code, enable user 2FA, return recovery codes, pass the session. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: { token?: string }
  try {
    body = (await request.json()) as { token?: string }
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: { code: 'MISSING_TOKEN', message: 'A code is required' } }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { recoveryCodes } = await activateTwoFactor(admin, user.id, token)
    const res = NextResponse.json({ ok: true, recoveryCodes })
    return await attachAdmin2faCookie(res, user.id)
  } catch (err) {
    if (err instanceof TwoFactorError) {
      const status = err.code === 'INVALID_CODE' ? 400 : err.code === 'NOT_ENROLLED' ? 409 : 500
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
    }
    throw err
  }
}
