import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPublicProfile } from '@/lib/supabase/profiles'
import AthleteProfileDetail from '@/components/discovery/athlete-profile-detail'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

/**
 * M-1 — deliberately GENERIC and identical for every record.
 *
 * A page title is written to browser history, sent in the document title to
 * analytics, and is visible on a shared screen or a screencast. Interpolating
 * the subject's name here ("Sarah Okoro — Athlete") would leak a real person's
 * identity into all three, so the title says only what kind of page this is.
 * `robots: { index: false }` keeps it out of search results as well.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Athlete profile · Podium',
    description: 'An athlete profile on Podium.',
    robots: { index: false },
  }
}


type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

/**
 * B-4 / PR-20 / PR-3 — the athlete detail page a brand lands on from the
 * discovery grid. `AthleteCard`'s "View profile" CTA has always pointed at
 * `/brand/discover/<userId>`; that route did not exist, so the marketplace's
 * primary action 404'd. The athlete-owned `/athlete/profile/[userId]` cannot be
 * reused because the `(athlete)` layout sends non-athletes to `/403`.
 */
export default async function BrandAthleteProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // getPublicProfile returns the role union; role 'athlete' narrows it to AthleteRow.
  const profile = (await getPublicProfile(supabase, userId, 'athlete')) as AthleteRow | null
  if (!profile) notFound()

  return <AthleteProfileDetail athlete={profile} backHref={ROUTES.brand.discover} />
}
