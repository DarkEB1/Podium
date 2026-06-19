import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import SubscriptionTiers from '@/components/brand/subscription-tiers'
export default async function BrandSubscriptionPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const subscription = await getSubscriptionForUser(supabase, user.id)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-12 md:px-16 md:py-16">
      <header className="space-y-3">
        <h1 className="text-display">Subscription</h1>
        <p className="text-medium text-muted-foreground">
          {subscription
            ? 'Manage your current plan.'
            : 'Choose a plan to start discovering athletes and teams.'}
        </p>
      </header>
      <SubscriptionTiers subscription={subscription} />
    </div>
  )
}
