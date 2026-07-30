import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { isVerified } from '@/lib/supabase/verification'
import TeamProfileDetail from '@/components/discovery/team-profile-detail'
import ConnectRequestButton from '@/components/discovery/connect-request-button'
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

  // team_profiles has no availability column, so unlike the athlete page there is
  // nothing to gate on: a published team is contactable. Before this the page
  // rendered the profile and a "Back" link only, with no way to reach the team.
  // QA-3.1: the badge follows an approved verification request. The detail
  // component used to infer it from status === 'active', which showed a trust
  // badge to every published team and ignored admin approval entirely.
  const verified = await isVerified(supabase, userId)

  return (
    <TeamProfileDetail
      team={profile}
      backHref={ROUTES.brand.discoverTeams}
      verified={verified}
      action={
        <ConnectRequestButton
          recipientUserId={profile.user_id}
          recipientName={profile.team_name ?? 'this team'}
          recipientRole="team"
          surface="brand_team_detail"
        />
      }
    />
  )
}
