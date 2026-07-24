import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getShortlist } from '@/lib/supabase/discovery'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { EmptyState } from '@/components/ui/empty-state'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Saved · Podium',
  description: 'The listings and brands you have shortlisted.',
  robots: { index: false, follow: false },
}

export default async function AthleteSavedPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const shortlist = await getShortlist(supabase, user.id)

  const profiles = await Promise.all(
    shortlist.map((item) => getPublicProfile(supabase, item.target_user_id, 'brand'))
  )
  const brands = profiles.filter(Boolean) as BrandRow[]

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <h1 className="font-heading text-display tracking-tight text-foreground">Saved brands</h1>
        <p className="mt-3 text-medium text-muted-foreground">{brands.length} saved</p>
      </div>
      {brands.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden="true" />}
          title="No saved brands yet"
          description="Browse opportunities and save the brands you like so you can find them again here."
          action={{ label: 'Browse opportunities', href: '/athlete/discover' }}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {brands.map((brand) => (
            <div key={brand.id} className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <p className="font-medium text-foreground">{(brand as { company_name?: string }).company_name ?? brand.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
