import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing } from '@/lib/supabase/discovery'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit listing</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm listing={listing} />
        </CardContent>
      </Card>
    </div>
  )
}
