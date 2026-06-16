import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getListings } from '@/lib/supabase/discovery'
import ListingsGrid from '@/components/discovery/listings-grid'

export default async function AthleteDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const listings = await getListings(supabase)
  const active = listings.filter((l) => l.status === 'active')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="font-heading text-large font-medium">Discover opportunities</h1>
        <p className="text-medium text-muted-foreground">
          Browse brand campaigns and send a personalised connection request.
        </p>
      </div>
      <ListingsGrid listings={active} />
    </div>
  )
}
