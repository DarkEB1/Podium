import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveAthleteProfiles } from '@/lib/supabase/profiles'
import AthletesGrid from '@/components/brand/athletes-grid'

export default async function BrandDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const athletes = await getActiveAthleteProfiles(supabase)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover athletes</h1>
        <p className="text-muted-foreground">{athletes.length} active athletes on Podium</p>
      </div>
      <AthletesGrid athletes={athletes} />
    </div>
  )
}
