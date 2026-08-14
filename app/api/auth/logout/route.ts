import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { clearSession } from '@/lib/supabase/sessions'
import { clearOnboardedCookie } from '@/lib/auth/onboarded-cookie'
import { ROUTES } from '@/lib/routes'

/**
 * PR-15 — sign out. Clears the Supabase session (which expires the auth
 * cookies) and tells the caller where to go next. Signing out must always
 * succeed from the user's point of view: if Supabase reports an error the
 * session cookies are still dropped, so we report success and let the client
 * land on the public home page rather than trapping them in a broken session.
 */
export async function POST() {
  const supabase = await createClient()

  // Remove this session's active_sessions row before the token is invalidated.
  try {
    const { data } = await supabase.auth.getSession()
    const user = await getUser(supabase)
    const refreshToken = data.session?.refresh_token
    if (user && refreshToken) {
      await clearSession(createAdminClient(), user.id, refreshToken)
    }
  } catch {
    /* sign-out must always succeed from the user's point of view */
  }

  const { error } = await supabase.auth.signOut()

  const response = NextResponse.json({
    success: true,
    redirectTo: ROUTES.home,
    ...(error ? { warning: error.message } : {}),
  })
  // Drop the onboarding fast-path cookie so it can never leak to a different
  // user who signs in next on this browser. See lib/auth/onboarded-cookie.ts.
  clearOnboardedCookie(response)
  return response
}
