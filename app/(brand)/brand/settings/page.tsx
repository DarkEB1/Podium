import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import BrandSettingsForm from '@/components/brand/brand-settings-form'
import CancelSubscription from '@/components/brand/cancel-subscription'
import type { Database } from '@/types/database'

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
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Company details</h2>
        <BrandSettingsForm profile={brandProfile} />
      </section>

      {hasActiveSubscription && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-muted-foreground">
            You are on Tier {subscription!.tier}. Your subscription renews on{' '}
            {new Date(subscription!.current_period_end).toLocaleDateString()}.
          </p>
          <CancelSubscription />
        </section>
      )}
    </div>
  )
}
