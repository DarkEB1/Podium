import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getMatches } from '@/lib/supabase/messaging'
import { getListings } from '@/lib/supabase/discovery'
import { getProposals } from '@/lib/supabase/deals'
import StatStrip from '@/components/layout/stat-strip'
import { AccentHeading } from '@/components/ui/accent-heading'
import { SectionDivider } from '@/components/ui/section-divider'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import type { Database } from '@/types/database'

type TeamRow = Database['public']['Tables']['team_profiles']['Row']

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Team dashboard · Podium',
  description: 'Your team’s sponsorship activity: listings, conversations and deals.',
  robots: { index: false, follow: false },
}

export default async function TeamDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, matches, listings] = await Promise.all([
    getOwnProfile(supabase, user.id, 'team'),
    getMatches(supabase, user.id),
    getListings(supabase),
  ])

  // getOwnProfile with the 'team' role returns a TeamRow or null.
  const teamProfile = profile as TeamRow | null
  if (!teamProfile) redirect('/team/onboarding')

  // Proposals are scoped per match; gather across the team's matches, then keep
  // only those this team sent. Empty matches simply contribute nothing.
  const proposalsByMatch = await Promise.all(
    matches.map((m) => getProposals(supabase, m.id)),
  )
  const proposals = proposalsByMatch.flat()
  const proposalsSent = proposals.filter((p) => p.sender_id === user.id).length
  const dealsClosed = proposals.filter((p) => p.status === 'accepted').length

  const activeListings = listings.filter(
    (l) => l.brand_id === teamProfile.id && l.status === 'active',
  ).length

  const totalMatches = matches.length
  const hasActivity =
    totalMatches > 0 || proposalsSent > 0 || dealsClosed > 0 || activeListings > 0

  const isActive = teamProfile.status === 'active'

  const statusMessage =
    teamProfile.status === 'pending_review'
      ? 'Your profile is under review. You will be notified when it goes live.'
      : teamProfile.status === 'active'
        ? 'Your profile is live and visible to sponsors.'
        : teamProfile.status === 'draft'
          ? 'Finish setting up your profile so sponsors can find you.'
          : `Profile status: ${teamProfile.status}`

  const teamName = teamProfile.nickname ?? teamProfile.team_name ?? 'your team'

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">
          Welcome, {teamName}
        </AccentHeading>
        <p className="mt-3 text-medium text-muted-foreground">{statusMessage}</p>
      </div>

      <SectionDivider label="Your numbers" />

      <StatStrip
        stats={[
          { label: 'Active Listings', value: String(activeListings) },
          { label: 'Total Matches', value: String(totalMatches) },
          { label: 'Proposals Sent', value: String(proposalsSent) },
          { label: 'Deals Closed', value: String(dealsClosed) },
        ]}
      />

      {!isActive && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-6 md:p-8">
          <p className="text-large text-foreground">Profile not yet live</p>
          <p className="mt-2 text-medium text-muted-foreground">
            Complete your team profile to appear in sponsor discovery feeds.
          </p>
          <Link
            href="/team/onboarding"
            className={`${buttonVariants({ size: 'sm' })} mt-5`}
          >
            Finish profile
          </Link>
        </div>
      )}

      {isActive && !hasActivity ? (
        <div
          data-testid="team-dashboard-empty"
          className="rounded-2xl border border-border bg-card shadow-sm"
        >
          <EmptyState
            title="No activity yet"
            description="Find sponsors whose goals match your team, then send your first proposal. Your matches, proposals, and closed deals will appear here."
            action={{ label: 'Find sponsors', href: '/team/discover' }}
          />
        </div>
      ) : null}

      {isActive && hasActivity && (
        <div className="flex flex-wrap gap-3">
          <Link href={ROUTES.team.discover} className={buttonVariants()}>
            Find sponsors
          </Link>
          {/* B-4: /team/listings and /team/messages do not exist — these two
              buttons 404'd. Teams have no listings or messaging surface yet, so
              link to what is actually built rather than shipping dead CTAs. */}
          <Link
            href={ROUTES.team.settings}
            className={buttonVariants({ variant: 'outline' })}
          >
            Team settings
          </Link>
        </div>
      )}
    </div>
  )
}
