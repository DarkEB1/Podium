import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getMatches } from '@/lib/supabase/messaging'
import { getListings } from '@/lib/supabase/discovery'
import { getProposals } from '@/lib/supabase/deals'
import StatStrip from '@/components/layout/stat-strip'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

export default async function BrandDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, subscription, matches, listings] = await Promise.all([
    getOwnProfile(supabase, user.id, 'brand'),
    getSubscriptionForUser(supabase, user.id),
    getMatches(supabase, user.id),
    getListings(supabase),
  ])

  // getOwnProfile with 'brand' role returns a BrandRow or null
  const brandProfile = profile as BrandRow | null
  if (!brandProfile) redirect('/brand/onboarding')

  // Proposals are scoped per match; gather across the brand's matches, then keep
  // only those this brand sent. Empty matches simply contribute nothing.
  const proposalsByMatch = await Promise.all(
    matches.map((m) => getProposals(supabase, m.id)),
  )
  const proposals = proposalsByMatch.flat()
  const proposalsSent = proposals.filter((p) => p.sender_id === user.id).length
  const dealsClosed = proposals.filter((p) => p.status === 'accepted').length

  const activeListings = listings.filter(
    (l) => l.brand_id === brandProfile.id && l.status === 'active',
  ).length

  const totalMatches = matches.length
  const hasActivity =
    totalMatches > 0 || proposalsSent > 0 || dealsClosed > 0 || activeListings > 0

  const isActive = brandProfile.status === 'active'
  const hasSubscription = Boolean(
    subscription && ['active', 'trialing'].includes(subscription.status),
  )

  const statusMessage =
    brandProfile.status === 'pending_approval'
      ? 'Your profile is under review. You will be notified when approved.'
      : brandProfile.status === 'active'
        ? 'Your profile is live and visible to athletes.'
        : `Profile status: ${brandProfile.status}`

  const companyName = brandProfile.trading_name ?? brandProfile.company_name

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-heading text-large font-semibold text-foreground">
          Welcome, {companyName}
        </h1>
        <p className="mt-1 text-medium text-muted-foreground">{statusMessage}</p>
      </div>

      <StatStrip
        stats={[
          { label: 'Active Listings', value: String(activeListings) },
          { label: 'Total Matches', value: String(totalMatches) },
          { label: 'Proposals Sent', value: String(proposalsSent) },
          { label: 'Deals Closed', value: String(dealsClosed) },
        ]}
      />

      {!hasSubscription && (
        <div className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 p-4">
          <p className="text-medium font-semibold text-foreground">Subscription required</p>
          <p className="mt-1 text-small text-muted-foreground">
            Set up a subscription to discover and connect with athletes and teams.
          </p>
          <Link
            href="/brand/subscription"
            className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}
          >
            Choose a plan
          </Link>
        </div>
      )}

      {isActive && hasSubscription && !hasActivity ? (
        <div
          data-testid="brand-dashboard-empty"
          className="rounded-[var(--radius)] border bg-card shadow-[var(--shadow-card)]"
        >
          <EmptyState
            title="No activity yet"
            description="Discover athletes and teams, then send your first proposal. Your matches, proposals, and closed deals will appear here."
            action={{ label: 'Discover athletes', href: '/brand/discover' }}
          />
        </div>
      ) : null}

      {isActive && hasActivity && (
        <div className="flex flex-wrap gap-3">
          <Link href="/brand/discover" className={buttonVariants()}>
            Discover athletes
          </Link>
          <Link
            href="/brand/listings"
            className={buttonVariants({ variant: 'outline' })}
          >
            My listings
          </Link>
          <Link
            href="/brand/messages"
            className={buttonVariants({ variant: 'outline' })}
          >
            Messages
          </Link>
        </div>
      )}
    </div>
  )
}
