import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveAthleteProfiles } from '@/lib/supabase/profiles'
import { getShortlist } from '@/lib/supabase/discovery'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import AthletesGrid from '@/components/brand/athletes-grid'

export default async function BrandDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [athletes, shortlist, subscription] = await Promise.all([
    getActiveAthleteProfiles(supabase),
    getShortlist(supabase, user.id),
    getSubscriptionForUser(supabase, user.id),
  ])

  const savedUserIds = shortlist.map((s) => s.target_user_id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-large font-heading">Discover athletes</h1>
        <p className="text-muted-foreground">{athletes.length} active athletes on Podium</p>
      </div>
      <AthletesGrid
        athletes={athletes}
        savedUserIds={savedUserIds}
        {...(subscription ? { tier: subscription.tier } : {})}
      />
    </div>
  )
}
