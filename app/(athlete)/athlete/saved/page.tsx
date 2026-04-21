import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getShortlist } from '@/lib/supabase/discovery'
import { getPublicProfile } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

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
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved brands</h1>
        <p className="text-muted-foreground">{brands.length} saved</p>
      </div>
      {brands.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No saved brands yet. Browse <a href="/athlete/discover" className="underline">opportunities</a> to find brands you like.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <div key={brand.id} className="rounded-xl border bg-card p-5">
              <p className="font-semibold">{(brand as { company_name?: string }).company_name ?? brand.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
