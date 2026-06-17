import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListings } from '@/lib/supabase/discovery'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import ListingsManager from './listings-manager'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

export default async function BrandListingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns BrandRow for 'brand' role
  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  const allListings = await getListings(supabase) as JobListingRow[]
  const myListings = allListings.filter((l) => l.brand_id === profile.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-large font-bold text-foreground">My listings</h1>
        <Link href="/brand/listings/new" className={buttonVariants()}>+ New listing</Link>
      </div>

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
