import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPlatformAnalytics } from '@/lib/supabase/admin-insights'
import StatGrid from '@/components/admin/stat-grid'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Analytics · Podium Admin', robots: { index: false } }

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const a = await getPlatformAnalytics(createAdminClient())

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Analytics</p>
        <AccentHeading as="h1" className="text-display">Analytics</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">Platform totals at a glance.</p>
      </div>
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
