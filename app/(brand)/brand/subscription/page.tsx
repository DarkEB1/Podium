import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import SubscriptionTiers from '@/components/brand/subscription-tiers'
import { AccentHeading } from '@/components/ui/accent-heading'
// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Subscription · Podium',
  description: 'Manage your Podium plan and billing.',
  robots: { index: false, follow: false },
}

export default async function BrandSubscriptionPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const subscription = await getSubscriptionForUser(supabase, user.id)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-12 md:px-16 md:py-16">
      <header className="space-y-3">
        <AccentHeading as="h1" className="text-display">Subscription</AccentHeading>
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
