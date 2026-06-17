import { redirect } from 'next/navigation'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListings } from '@/lib/supabase/discovery'
import { MarketplaceCard } from '@/components/ui/marketplace-card'
import { EmptyState } from '@/components/ui/empty-state'
import type { Database } from '@/types/database'

type TeamRow = Database['public']['Tables']['team_profiles']['Row']

// Inline placeholder cover for listings without imagery (palette/light mode only).
// Kept self-contained so the feed never references a missing public asset.
const LISTING_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="320" height="192" fill="#e7e5e4"/></svg>',
  )

export default async function TeamDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, listings] = await Promise.all([
    getOwnProfile(supabase, user.id, 'team'),
    getListings(supabase),
  ])

  const teamProfile = profile as TeamRow | null
  if (!teamProfile) redirect('/team/onboarding')

  // Teams seek sponsors, so their discovery feed surfaces active brand
  // sponsorship listings. Establishing this feed is the team's discovery presence.
  const activeListings = listings.filter((l) => l.status === 'active')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-large font-semibold text-foreground">
          Find sponsors
        </h1>
        <p className="mt-1 text-medium text-muted-foreground">
          {activeListings.length} active sponsorship{' '}
          {activeListings.length === 1 ? 'listing' : 'listings'} on Podium
        </p>
      </div>

      {activeListings.length === 0 ? (
        <div
          data-testid="team-discover-empty"
          className="rounded-[var(--radius)] border bg-card shadow-[var(--shadow-card)]"
        >
          <EmptyState
            icon={<Compass aria-hidden="true" />}
            title="No sponsorship listings yet"
            description="When brands post sponsorship opportunities, they will appear here. Make sure your team profile is complete so sponsors can find you too."
            action={{ label: 'View your profile', href: '/team/profile' }}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeListings.map((listing) => (
            <li key={listing.id}>
              <MarketplaceCard
                image={LISTING_PLACEHOLDER}
                imageAlt={`${listing.title} sponsorship listing`}
                title={listing.title}
                {...(listing.sport_required
                  ? { subtitle: listing.sport_required }
                  : {})}
                cta={{ label: 'View listing', href: `/team/discover/${listing.id}` }}
                href={`/team/discover/${listing.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
