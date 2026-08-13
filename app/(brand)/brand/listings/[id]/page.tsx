import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing } from '@/lib/supabase/discovery'
import ListingForm from '@/components/brand/listing-form'
import { AccentHeading } from '@/components/ui/accent-heading'
import type { Database } from '@/types/database'

/**
 * M-1 — deliberately GENERIC and identical for every record.
 *
 * A page title is written to browser history, sent in the document title to
 * analytics, and is visible on a shared screen or a screencast. Interpolating
 * the subject's name here ("Sarah Okoro — Athlete") would leak a real person's
 * identity into all three, so the title says only what kind of page this is.
 * `robots: { index: false }` keeps it out of search results as well.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Listing · Podium',
    description: 'A sponsorship listing on Podium.',
    robots: { index: false },
  }
}


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
      <AccentHeading as="h1" className="text-display">
        Edit listing
      </AccentHeading>
      <ListingForm listing={listing} />
    </div>
  )
}
