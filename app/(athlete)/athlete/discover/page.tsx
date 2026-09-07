import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveListingsPage, LISTING_PAGE_SIZE } from '@/lib/supabase/discovery'
import { getDiscoveryUiMode, getOwnProfile } from '@/lib/supabase/profiles'
import { decorateWithMatch } from '@/lib/discovery/match'
import { buildRails } from '@/lib/discovery/rails'
import type { Database } from '@/types/database'
import { DiscoverFeed } from '@/components/discovery/discover-feed'
import LoadMore from '@/components/discovery/load-more'
import { parseShowParam } from '@/lib/pagination'
import { ROUTES } from '@/lib/routes'
import { AccentHeading } from '@/components/ui/accent-heading'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Discover opportunities · Podium',
  description: 'Browse sponsorship listings from brands looking for athletes like you.',
  robots: { index: false },
}


export default async function AthleteDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // FA-5: bounded page + a "load more" link, instead of every listing in the
  // table filtered down to `status === 'active'` in JavaScript.
  const params = (await searchParams) ?? {}
  const shown = parseShowParam(params.show, LISTING_PAGE_SIZE)

  const [{ listings, hasMore }, mode, profile] = await Promise.all([
    // WS-LISTING-03: athletes only see brand-to-athlete endorsement campaigns,
    // never team_sponsorship listings aimed at clubs.
    getActiveListingsPage(supabase, { limit: shown, type: 'athlete_endorsement' }),
    getDiscoveryUiMode(supabase, user.id, 'athlete'),
    getOwnProfile(supabase, user.id, 'athlete'),
  ])

  // Spec Section 10: score this page of listings by fit for the athlete, then
  // group them into the made-for-you rails the Live Board feed renders.
  // getOwnProfile returns the role union; role 'athlete' narrows it to the row
  // the scorer reads. decorateWithMatch tolerates a null athlete; buildRails and
  // the flat grid each sort on their own, so the page no longer pre-sorts.
  const athlete = profile as Database['public']['Tables']['athlete_profiles']['Row'] | null
  const athleteSport = athlete?.primary_sport ?? null
  const scored = decorateWithMatch(listings, athlete)
  const rails = buildRails(scored, { athleteSport })

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">
          {athleteSport ? `Ranked for you, ${athleteSport}` : 'Discover opportunities'}
        </AccentHeading>
        <p className="mt-3 max-w-[52ch] text-medium leading-relaxed text-muted-foreground">
          Browse brand campaigns and send a personalised connection request.
        </p>
      </div>
      {/* PR-23: both browse modes ship, so the feed renders the toggle. */}
      <DiscoverFeed
        listings={scored}
        rails={rails}
        initialMode={mode}
        athleteSport={athleteSport}
        footer={
          hasMore ? (
            <LoadMore
              href={`${ROUTES.athlete.discover}?show=${shown + LISTING_PAGE_SIZE}`}
              shown={listings.length}
              label="Load more campaigns"
            />
          ) : undefined
        }
      />
    </div>
  )
}
