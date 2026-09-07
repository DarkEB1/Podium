import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getActiveListingsPage, LISTING_PAGE_SIZE } from '@/lib/supabase/discovery'
import ListingsBrowser from '@/components/discovery/listings-browser'
import LoadMore from '@/components/discovery/load-more'
import { AccentHeading } from '@/components/ui/accent-heading'
import { parseShowParam } from '@/lib/pagination'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Discover sponsors · Podium',
  description: 'Browse brands looking to sponsor teams and clubs.',
  robots: { index: false },
}


type TeamRow = Database['public']['Tables']['team_profiles']['Row']

export default async function TeamDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const params = (await searchParams) ?? {}
  const shown = parseShowParam(params.show, LISTING_PAGE_SIZE)

  // FA-5: one bounded, server-filtered page of active listings.
  const [profile, { listings, hasMore }] = await Promise.all([
    getOwnProfile(supabase, user.id, 'team'),
    // WS-LISTING-03: teams only see brand-to-team sponsorship listings, never
    // athlete_endorsement campaigns aimed at individual athletes.
    getActiveListingsPage(supabase, { limit: shown, type: 'team_sponsorship' }),
  ])

  // getOwnProfile returns the role union; role 'team' narrows it to TeamRow.
  const teamProfile = profile as TeamRow | null
  if (!teamProfile) redirect(ROUTES.team.onboarding)

  return (
    <div
      data-testid="team-discover"
      className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16"
    >
      <div>
        <AccentHeading as="h1" className="text-display">Find sponsors</AccentHeading>
        <p className="mt-3 text-medium text-muted-foreground">
          {listings.length}
          {hasMore ? '+' : ''} active sponsorship{' '}
          {listings.length === 1 && !hasMore ? 'listing' : 'listings'} on Podium
        </p>
      </div>

      {/*
        B-4: these cards used to link to `/team/discover/<listingId>`, a route
        that does not exist, and the empty state linked to `/team/profile`,
        which also did not exist. ListingsBrowser wraps the same surface athletes
        use — it opens the listing in a dialog and sends the connection request
        inline, so nothing navigates to a missing page — plus the PR-23 browse
        mode toggle.
      */}
      <ListingsBrowser
        listings={listings}
        initialMode={teamProfile.discovery_ui_mode}
        {...(hasMore
          ? {
              footer: (
                <LoadMore
                  href={`${ROUTES.team.discover}?show=${shown + LISTING_PAGE_SIZE}`}
                  shown={listings.length}
                  label="Load more listings"
                />
              ),
            }
          : {})}
      />
    </div>
  )
}
