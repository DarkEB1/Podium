import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveListingsPage, LISTING_PAGE_SIZE } from '@/lib/supabase/discovery'
import { getDiscoveryUiMode, getOwnProfile } from '@/lib/supabase/profiles'
import { sortListingsByMatch } from '@/lib/matching/score'
import type { Database } from '@/types/database'
import ListingsBrowser from '@/components/discovery/listings-browser'
import LoadMore from '@/components/discovery/load-more'
import { parseShowParam } from '@/lib/pagination'
import { ROUTES } from '@/lib/routes'

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
    getActiveListingsPage(supabase, { limit: shown }),
    getDiscoveryUiMode(supabase, user.id, 'athlete'),
    getOwnProfile(supabase, user.id, 'athlete'),
  ])

  // Spec Section 10: rank this page of listings by fit for the athlete, so the
  // most relevant opportunities surface first. getOwnProfile returns the role
  // union; role 'athlete' narrows it to the row the scorer reads.
  const athlete = profile as Database['public']['Tables']['athlete_profiles']['Row'] | null
  const ranked = athlete ? sortListingsByMatch(listings, athlete) : listings

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <h1 className="font-heading text-display tracking-tight text-foreground">Discover opportunities</h1>
        <p className="mt-3 max-w-[52ch] text-medium leading-relaxed text-muted-foreground">
          Browse brand campaigns and send a personalised connection request.
        </p>
      </div>
      {/* PR-23: both browse modes ship, so the page renders the toggle. */}
      <ListingsBrowser
        listings={ranked}
        initialMode={mode}
        {...(hasMore
          ? {
              footer: (
                <LoadMore
                  href={`${ROUTES.athlete.discover}?show=${shown + LISTING_PAGE_SIZE}`}
                  shown={listings.length}
                  label="Load more campaigns"
                />
              ),
            }
          : {})}
      />
    </div>
  )
}
