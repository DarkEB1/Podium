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
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div>
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          Discover athletes
        </h1>
        <p className="mt-3 text-medium text-muted-foreground">
          {athletes.length} active athletes on Podium
        </p>
      </div>
      <AthletesGrid
        athletes={athletes}
        savedUserIds={savedUserIds}
        {...(subscription ? { tier: subscription.tier } : {})}
      />
    </div>
  )
}
