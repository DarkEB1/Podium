import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPlatformAnalytics } from '@/lib/supabase/admin-insights'
import StatGrid from '@/components/admin/stat-grid'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Analytics · Podium Admin', robots: { index: false } }

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const a = await getPlatformAnalytics(createAdminClient())

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Analytics</h1>
      <p className="mt-3 text-medium text-muted-foreground">Platform totals at a glance.</p>
      <div className="mt-8">
        <StatGrid
          stats={[
            { label: 'Athletes', value: a.athletes },
            { label: 'Brands', value: a.brands },
            { label: 'Teams', value: a.teams },
            { label: 'Agents', value: a.agents },
            { label: 'Active listings', value: a.activeListings },
            { label: 'Matches', value: a.matches },
            { label: 'Contracts', value: a.contracts },
            { label: 'Reports to review', value: a.pendingReports },
            { label: 'Verifications to review', value: a.pendingVerifications },
          ]}
        />
      </div>
    </div>
  )
}
