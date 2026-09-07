import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  beginEnrollment,
  getTwoFactorStatus,
  verifyTwoFactorLogin,
} from '@/lib/supabase/two-factor'
import { ADMIN_2FA_COOKIE, verifyAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie'

/**
 * Start admin 2FA enrollment: mint a pending secret and return the otpauth URL
 * and manual key for the admin to add to their authenticator (2.4). Admin only.
 *
 * WS-SEC-02 — `/api/admin/2fa/*` is exempt from the middleware 2FA-cookie gate
 * (an admin needs it to obtain the cookie). This handler therefore runs on a
 * password-only session. `beginEnrollment` overwrites the stored secret, wipes
 * the recovery codes and returns the fresh secret in plaintext, so if it ran
 * unconditionally a password-only attacker could re-enroll, compute a TOTP,
 * activate and pass the cookie — while simultaneously destroying the real
 * admin's authenticator. So once 2FA is already enabled, re-enrolment must prove
 * possession of the CURRENT second factor: a valid 2FA session cookie, or a
 * current TOTP / recovery code. First-time enrolment (nothing enabled yet) is
 * unaffected.
 */
export async function POST(request: NextRequest) {
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

    const status = await getTwoFactorStatus(admin, user.id)
    if (status.enabled) {
      // A body is optional; only read it to look for a current code.
      let token: string | undefined
      try {
        token = ((await request.json()) as { token?: string }).token?.trim()
      } catch {
        token = undefined
      }

      const cookieOk = await verifyAdmin2faCookie(
        request.cookies.get(ADMIN_2FA_COOKIE)?.value,
        user.id
      )
      const codeOk = !cookieOk && !!token && (await verifyTwoFactorLogin(admin, user.id, token))

      if (!cookieOk && !codeOk) {
        return NextResponse.json(
          {
            error: {
              code: 'TWO_FACTOR_ALREADY_ENABLED',
              message:
                'Two-factor is already set up. Confirm with your current authenticator code or an active 2FA session before re-enrolling.',
            },
          },
          { status: 409 }
        )
      }
    }

    const { secret, otpauthUrl } = await beginEnrollment(admin, user.id, user.email)
    return NextResponse.json({ secret, otpauthUrl })
  } catch (err) {
    // A missing TWO_FACTOR_ENCRYPTION_KEY surfaces here as a clear 500.
    const message = err instanceof Error ? err.message : 'Could not start 2FA setup'
    return NextResponse.json({ error: { code: 'ENROLL_FAILED', message } }, { status: 500 })
  }
}
