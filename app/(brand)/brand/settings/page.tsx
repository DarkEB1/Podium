import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import BrandSettingsForm from '@/components/brand/brand-settings-form'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Settings · Podium',
  description: 'Manage your Podium account, billing, notifications and privacy.',
  robots: { index: false },
}


type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

export default async function BrandSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, subscription] = await Promise.all([
    getOwnProfile(supabase, user.id, 'brand'),
    getSubscriptionForUser(supabase, user.id),
  ])

  // getOwnProfile returns BrandRow for 'brand' role
  const brandProfile = profile as BrandRow | null
  if (!brandProfile) redirect('/brand/onboarding')

  const hasActiveSubscription =
    subscription &&
    ['active', 'trialing'].includes(subscription.status) &&
    !subscription.cancellation_scheduled_at

  return (
    <BrandSettingsForm
      profile={brandProfile}
      activeSubscription={
        hasActiveSubscription
          ? { tier: subscription!.tier, currentPeriodEnd: subscription!.current_period_end }
          : null
      }
    />
  )
}
