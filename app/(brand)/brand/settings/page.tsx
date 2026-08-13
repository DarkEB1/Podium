import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import BrandSettingsForm from '@/components/brand/brand-settings-form'
import { AccentHeading } from '@/components/ui/accent-heading'
import CancelSubscription from '@/components/brand/cancel-subscription'
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
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-16 md:px-16 md:py-16">
      <header className="space-y-3">
        <AccentHeading as="h1" className="text-display">Settings</AccentHeading>
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
