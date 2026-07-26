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
    title: 'Client profile · Podium',
    description: 'A client profile on Podium.',
    robots: { index: false },
  }
}


type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

/**
 * The client profile an agent opens from their roster. `ClientTable`'s
 * "View Profile" action links here (`/agent/profile/<clientUserId>`); the route
 * did not exist, so every roster row's primary action 404'd.
 */
export default async function AgentClientProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'agent') redirect(ROUTES.forbidden)

  // getPublicProfile returns the role union; role 'athlete' narrows it to AthleteRow.
  const profile = (await getPublicProfile(supabase, userId, 'athlete')) as AthleteRow | null
  if (!profile) notFound()

  return (
    <AthleteProfileDetail
      athlete={profile}
      backHref={ROUTES.agent.clients}
      backLabel="Back to clients"
    />
  )
}
