import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing } from '@/lib/supabase/discovery'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ListingForm from '@/components/brand/listing-form'
import DuplicateListingForm from '../duplicate-listing-form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams

  // No duplicate source — plain create via the canonical ListingForm.
  if (!from) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create a listing</CardTitle>
          </CardHeader>
          <CardContent>
            <ListingForm listing={null} />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Duplicate flow: load the source listing and pre-fill a new (POST-only) draft.
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns BrandRow for 'brand' role
  const profile = (await getOwnProfile(supabase, user.id, 'brand')) as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  // getListing returns the job listing row or null
  const source = (await getListing(supabase, from)) as JobListingRow | null

  // Only allow duplicating the brand's own listings; otherwise fall back to a blank create.
  if (!source || source.brand_id !== profile.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create a listing</CardTitle>
          </CardHeader>
          <CardContent>
            <ListingForm listing={null} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Duplicate listing</CardTitle>
        </CardHeader>
        <CardContent>
          <DuplicateListingForm source={source} />
        </CardContent>
      </Card>
    </div>
  )
}
