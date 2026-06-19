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
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <h1 className="font-heading text-display tracking-tight text-foreground">Discover opportunities</h1>
        <p className="mt-3 max-w-[52ch] text-medium leading-relaxed text-muted-foreground">
          Browse brand campaigns and send a personalised connection request.
        </p>
      </div>
      <ListingsGrid listings={active} />
    </div>
  )
}
