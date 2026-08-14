import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListings } from '@/lib/supabase/discovery'
import { getEntitlementUsage } from '@/lib/supabase/entitlements'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { AccentHeading } from '@/components/ui/accent-heading'
import { UsageMeter } from '@/components/brand/usage-meter'
import ListingsManager from './listings-manager'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Your listings · Podium',
  description: 'Create, publish and manage the sponsorship opportunities your brand is offering.',
  robots: { index: false, follow: false },
}

export default async function BrandListingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns BrandRow for 'brand' role
  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  const [allListingsRaw, usage] = await Promise.all([
    getListings(supabase),
    getEntitlementUsage(supabase, user.id),
  ])
  const allListings = allListingsRaw as JobListingRow[]
  const myListings = allListings.filter((l) => l.brand_id === profile.id)

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AccentHeading as="h1" className="text-display">
          My listings
        </AccentHeading>
        <Link href="/brand/listings/new" className={buttonVariants()}>+ New listing</Link>
      </div>

      {usage ? (
        <UsageMeter
          label="Active listings"
          used={usage.listings.used}
          limit={usage.listings.limit}
        />
      ) : null}

      {myListings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Create a listing to start matching with athletes and teams."
          action={{ label: 'Create your first listing', href: '/brand/listings/new' }}
        />
      ) : (
        <ListingsManager
          listings={myListings.map((l) => ({
            id: l.id,
            title: l.title,
            type: l.type,
            status: l.status,
            sport_required: l.sport_required,
          }))}
        />
      )}
    </div>
  )
}
