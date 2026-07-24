import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const { error } = await supabase.auth.signOut()

  return NextResponse.json({
    success: true,
    redirectTo: ROUTES.home,
    ...(error ? { warning: error.message } : {}),
  })
}
