import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPublicProfile } from '@/lib/supabase/profiles'
import TeamProfileDetail from '@/components/discovery/team-profile-detail'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

// M-1 — deliberately generic title, identical for every team, so a real team's
// identity never leaks into browser history, analytics, or a shared screen.
export function generateMetadata(): Metadata {
  return {
    title: 'Team profile · Podium',
    description: 'A team profile on Podium.',
    robots: { index: false },
  }
}

type TeamRow = Database['public']['Tables']['team_profiles']['Row']

/** 2.2 — the team detail page a brand lands on from team discovery. */
export default async function BrandTeamProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // getPublicProfile returns the role union; role 'team' narrows it to TeamRow.
  const profile = (await getPublicProfile(supabase, userId, 'team')) as TeamRow | null
  if (!profile) notFound()

  return <TeamProfileDetail team={profile} backHref={ROUTES.brand.discoverTeams} />
}
