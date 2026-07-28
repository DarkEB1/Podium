import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionOverview } from '@/lib/supabase/admin-insights'
import StatGrid from '@/components/admin/stat-grid'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Subscriptions · Podium Admin', robots: { index: false } }

const TIER_NAME: Record<number, string> = { 1: 'Starter', 2: 'Growth', 3: 'Enterprise' }

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const s = await getSubscriptionOverview(createAdminClient())

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Subscriptions</h1>
      <p className="mt-3 text-medium text-muted-foreground">{s.total} subscriptions.</p>

      <div className="mt-8">
        <StatGrid
          stats={[1, 2, 3].map((tier) => ({
            label: TIER_NAME[tier] ?? `Tier ${tier}`,
            value: s.byTier[tier] ?? 0,
          }))}
        />
      </div>

      <h2 className="mt-10 font-heading text-large font-semibold text-foreground">By status</h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {Object.entries(s.byStatus).map(([status, n]) => (
          <li key={status} className="rounded-full border border-border px-3 py-1 text-small text-foreground">
            {status}: {n}
          </li>
        ))}
      </ul>
    </div>
  )
}
