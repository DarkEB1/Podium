import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { ENTITLEMENTS, isTier } from '@/lib/entitlements'
import { AnalyticsDashboard } from '@/components/brand/analytics/analytics-dashboard'
import { AnalyticsLocked } from '@/components/brand/analytics/analytics-locked'

// M-1: per-route metadata. Authenticated surface: robots.index = false
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = { robots: { index: false, follow: false } }

export default async function BrandAnalyticsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')
  if (user.role !== 'brand') redirect('/auth')

  // cast: getOwnProfile returns a role-union row; brand branch guaranteed by role check above
  const brandProfile = (await getOwnProfile(supabase, user.id, 'brand')) as { id: string } | null
  if (!brandProfile) redirect('/brand/onboarding')

  const sub = await getSubscriptionForUser(supabase, user.id)
  const tier = sub && isTier(sub.tier) ? sub.tier : null
  const unlocked = tier !== null && ENTITLEMENTS[tier].analytics && (sub?.status === 'active' || sub?.status === 'trialing')

  if (!unlocked || !sub) return <AnalyticsLocked />

  const analytics = await getBrandAnalytics(
    supabase,
    user.id,
    brandProfile.id,
    sub.current_period_start,
    sub.current_period_end
  )
  return <AnalyticsDashboard data={analytics} />
}
