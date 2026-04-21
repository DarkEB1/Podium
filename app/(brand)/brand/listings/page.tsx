import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListings } from '@/lib/supabase/discovery'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
        <h1 className="text-2xl font-bold">My listings</h1>
        <Link href="/brand/listings/new" className={buttonVariants()}>+ New listing</Link>
      </div>

      {myListings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No listings yet.</p>
          <Link href="/brand/listings/new" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
            Create your first listing
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {myListings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/brand/listings/${l.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.type.replace('_', ' ')} · {l.sport_required ?? 'Any sport'} · {l.status}
                  </p>
                </div>
                <span className={cn(
                  'text-xs rounded-full px-2 py-0.5 font-medium',
                  l.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
                )}>
                  {l.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
