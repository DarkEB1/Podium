import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing } from '@/lib/supabase/discovery'
import ListingForm from '@/components/brand/listing-form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns BrandRow for 'brand' role
  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  // getListing returns the job listing row or null
  const listing = await getListing(supabase, id) as JobListingRow | null
  if (!listing || listing.brand_id !== profile.id) redirect('/brand/listings')

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
        Edit listing
      </h1>
      <ListingForm listing={listing} />
    </div>
  )
}
