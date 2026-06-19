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
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-16 md:px-16 md:py-16">
      <header className="space-y-3">
        <h1 className="text-display">Settings</h1>
        <p className="text-medium text-muted-foreground">
          Manage your company profile and subscription.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-large">Company details</h2>
        <BrandSettingsForm profile={brandProfile} />
      </section>

      {hasActiveSubscription && (
        <section className="space-y-6">
          <h2 className="text-large">Subscription</h2>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <p className="text-medium text-muted-foreground">
              You are on Tier {subscription!.tier}. Your subscription renews on{' '}
              <span className="text-foreground font-medium">
                {new Date(subscription!.current_period_end).toLocaleDateString()}
              </span>
              .
            </p>
            <CancelSubscription />
          </div>
        </section>
      )}
    </div>
  )
}
