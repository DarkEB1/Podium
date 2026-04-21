import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import SubscriptionTiers from '@/components/brand/subscription-tiers'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

export default async function BrandSubscriptionPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getSubscriptionForUser returns the subscription row for the authenticated user
  const subscription = await getSubscriptionForUser(supabase, user.id) as SubscriptionRow | null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          {subscription
            ? 'Manage your current plan.'
            : 'Choose a plan to start discovering athletes and teams.'}
        </p>
      </div>
      <SubscriptionTiers subscription={subscription} />
    </div>
  )
}
