import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPublicProfile } from '@/lib/supabase/profiles'
import AthleteProfileDetail from '@/components/discovery/athlete-profile-detail'
import TeamProfileDetail from '@/components/discovery/team-profile-detail'
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
type TeamRow = Database['public']['Tables']['team_profiles']['Row']

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

  // An agent's roster holds athletes and teams, and the roster links every row
  // here, so this page must resolve both. Looking up athlete_profiles only meant
  // every team client's "View Profile" action rendered a 404.
  // getPublicProfile returns the role union; the role argument narrows it.
  const athlete = (await getPublicProfile(supabase, userId, 'athlete')) as AthleteRow | null
  if (athlete) {
    return (
      <AthleteProfileDetail
        athlete={athlete}
        backHref={ROUTES.agent.clients}
        backLabel="Back to clients"
      />
    )
  }

  const team = (await getPublicProfile(supabase, userId, 'team')) as TeamRow | null
  if (!team) notFound()

  return (
    <TeamProfileDetail team={team} backHref={ROUTES.agent.clients} backLabel="Back to clients" />
  )
}
