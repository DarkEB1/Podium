import Link from 'next/link'
import { redirect } from 'next/navigation'
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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <AccentHeading as="h1" className="text-large">
          Welcome, {teamName}
        </AccentHeading>
        <p className="mt-1 text-medium text-muted-foreground">{statusMessage}</p>
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
        <div className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 p-4">
          <p className="text-medium font-semibold text-foreground">
            Profile not yet live
          </p>
          <p className="mt-1 text-small text-muted-foreground">
            Complete your team profile to appear in sponsor discovery feeds.
          </p>
          <Link
            href="/team/onboarding"
            className={`${buttonVariants({ size: 'sm' })} mt-3`}
          >
            Finish profile
          </Link>
        </div>
      )}

      {isActive && !hasActivity ? (
        <div
          data-testid="team-dashboard-empty"
          className="rounded-[var(--radius)] border bg-card shadow-[var(--shadow-card)]"
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
          <Link href="/team/discover" className={buttonVariants()}>
            Find sponsors
          </Link>
          <Link
            href="/team/listings"
            className={buttonVariants({ variant: 'outline' })}
          >
            My listings
          </Link>
          <Link
            href="/team/messages"
            className={buttonVariants({ variant: 'outline' })}
          >
            Messages
          </Link>
        </div>
      )}
    </div>
  )
}
