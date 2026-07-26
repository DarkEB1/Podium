import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { ROUTES } from '@/lib/routes'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Your profile · Podium',
  description: 'Review and edit the profile brands and agents see.',
  robots: { index: false },
}


/**
 * B-4 — the athlete nav's "Profile" item. Only `/athlete/profile/[userId]`
 * existed, so the nav item itself 404'd. This is the canonical "my profile"
 * entry point: it resolves the signed-in athlete and hands off to their own
 * public profile page, so there is exactly one profile renderer.
 */
export default async function AthleteOwnProfilePage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  redirect(ROUTES.athlete.profileFor(user.id))
}
