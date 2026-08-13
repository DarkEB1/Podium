import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveTeamProfilesPage, TEAM_PAGE_SIZE, getDiscoveryUiMode } from '@/lib/supabase/profiles'
import { getShortlist } from '@/lib/supabase/discovery'
import TeamsBrowser from '@/components/discovery/teams-browser'
import DiscoverySwitch from '@/components/brand/discovery-switch'
import LoadMore from '@/components/discovery/load-more'
import { AccentHeading } from '@/components/ui/accent-heading'
import { parseShowParam } from '@/lib/pagination'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Discover teams · Podium',
  description: 'Browse teams and clubs looking for sponsorship on Podium.',
  robots: { index: false },
}

export default async function BrandTeamsDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const params = (await searchParams) ?? {}
  const shown = parseShowParam(params.show, TEAM_PAGE_SIZE)

  const [{ teams, hasMore }, shortlist, mode] = await Promise.all([
    getActiveTeamProfilesPage(supabase, { limit: shown }),
    getShortlist(supabase, user.id),
    getDiscoveryUiMode(supabase, user.id, 'brand'),
  ])

  const savedUserIds = shortlist.map((s) => s.target_user_id)

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-5">
        <DiscoverySwitch active="teams" />
        <div>
          <AccentHeading as="h1" className="text-display">
            Discover teams
          </AccentHeading>
          <p className="mt-3 text-medium text-muted-foreground">
            {teams.length}
            {hasMore ? '+' : ''} active {teams.length === 1 && !hasMore ? 'team' : 'teams'} on Podium
          </p>
        </div>
      </div>
      <TeamsBrowser
        teams={teams}
        initialMode={mode}
        savedUserIds={savedUserIds}
        {...(hasMore
          ? {
              footer: (
                <LoadMore
                  href={`${ROUTES.brand.discoverTeams}?show=${shown + TEAM_PAGE_SIZE}`}
                  shown={teams.length}
                  label="Load more teams"
                />
              ),
            }
          : {})}
      />
    </div>
  )
}
