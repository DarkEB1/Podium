import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveAthleteProfilesPage, ATHLETE_PAGE_SIZE, getDiscoveryUiMode } from '@/lib/supabase/profiles'
import { getShortlist } from '@/lib/supabase/discovery'
import { getVerifiedUserIds } from '@/lib/supabase/verification'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getEntitlementUsage } from '@/lib/supabase/entitlements'
import AthletesBrowser from '@/components/discovery/athletes-browser'
import DiscoverySwitch from '@/components/brand/discovery-switch'
import LoadMore from '@/components/discovery/load-more'
import { UsageMeter } from '@/components/brand/usage-meter'
import { AccentHeading } from '@/components/ui/accent-heading'
import { parseShowParam } from '@/lib/pagination'
import { ROUTES } from '@/lib/routes'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Discover athletes and teams · Podium',
  description: 'Search athletes and teams available for sponsorship on Podium.',
  robots: { index: false },
}


export default async function BrandDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // FA-5/SB-9: a bounded, column-projected page instead of `select('*')` over
  // every athlete row.
  const params = (await searchParams) ?? {}
  const shown = parseShowParam(params.show, ATHLETE_PAGE_SIZE)

  const [{ athletes, hasMore }, shortlist, subscription, mode, usage] = await Promise.all([
    getActiveAthleteProfilesPage(supabase, { limit: shown }),
    getShortlist(supabase, user.id),
    getSubscriptionForUser(supabase, user.id),
    getDiscoveryUiMode(supabase, user.id, 'brand'),
    getEntitlementUsage(supabase, user.id),
  ])

  const savedUserIds = shortlist.map((s) => s.target_user_id)

  // QA-3.1: the grid has always accepted verifiedUserIds and no page ever passed
  // it, so an approved verification request produced no badge anywhere. This is
  // the annotation getVerifiedUserIds was written for.
  const verifiedUserIds = Array.from(
    await getVerifiedUserIds(
      supabase,
      athletes.map((a) => a.user_id)
    )
  )

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-5">
        <DiscoverySwitch active="athletes" />
        <div>
          <AccentHeading as="h1" className="text-display">
            Discover athletes
          </AccentHeading>
          <p className="mt-3 text-medium text-muted-foreground">
            {athletes.length}
            {hasMore ? '+' : ''} active athletes on Podium
          </p>
        </div>
      </div>
      {usage ? (
        <UsageMeter
          label="Connection requests this period"
          used={usage.requests.used}
          limit={usage.requests.limit}
        />
      ) : null}
      {/* PR-23: both browse modes ship, so the page renders the toggle. */}
      <AthletesBrowser
        athletes={athletes}
        initialMode={mode}
        savedUserIds={savedUserIds}
        verifiedUserIds={verifiedUserIds}
        {...(subscription ? { tier: subscription.tier } : {})}
        {...(hasMore
          ? {
              footer: (
                <LoadMore
                  href={`${ROUTES.brand.discover}?show=${shown + ATHLETE_PAGE_SIZE}`}
                  shown={athletes.length}
                  label="Load more athletes"
                />
              ),
            }
          : {})}
      />
    </div>
  )
}
