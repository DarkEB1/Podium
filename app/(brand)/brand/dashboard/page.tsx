import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getMatches } from '@/lib/supabase/messaging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

export default async function BrandDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, subscription, matches] = await Promise.all([
    getOwnProfile(supabase, user.id, 'brand'),
    getSubscriptionForUser(supabase, user.id),
    getMatches(supabase, user.id),
  ])

  // getOwnProfile with 'brand' role returns a BrandRow or null
  const brandProfile = profile as BrandRow | null
  if (!brandProfile) redirect('/brand/onboarding')

  const activeMatches = matches.filter((m) => m.status === 'active')
  const isActive = brandProfile.status === 'active'
  const hasSubscription = subscription && ['active', 'trialing'].includes(subscription.status)

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {brandProfile.trading_name ?? brandProfile.company_name}</h1>
        <p className="text-muted-foreground">
          {brandProfile.status === 'pending_approval'
            ? 'Your profile is under review. You will be notified when approved.'
            : brandProfile.status === 'active'
            ? 'Your profile is live and visible to athletes.'
            : `Profile status: ${brandProfile.status}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile status</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              brandProfile.status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            )}>
              {brandProfile.status.replace('_', ' ')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                hasSubscription
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                Tier {subscription.tier} · {subscription.status}
              </span>
            ) : (
              <Link href="/brand/subscription" className="text-sm underline text-muted-foreground hover:text-foreground">
                Set up subscription
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeMatches.length}</p>
          </CardContent>
        </Card>
      </div>

      {!hasSubscription && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Subscription required</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Set up a subscription to discover and connect with athletes and teams.
          </p>
          <Link href="/brand/subscription" className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}>
            Choose a plan
          </Link>
        </div>
      )}

      {isActive && (
        <div className="flex flex-wrap gap-3">
          <Link href="/brand/discover" className={buttonVariants()}>Discover athletes</Link>
          <Link href="/brand/listings" className={buttonVariants({ variant: 'outline' })}>My listings</Link>
          <Link href="/brand/messages" className={buttonVariants({ variant: 'outline' })}>
            Messages ({activeMatches.length})
          </Link>
        </div>
      )}
    </div>
  )
}
