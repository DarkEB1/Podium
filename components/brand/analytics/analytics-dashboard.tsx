'use client'

import Link from 'next/link'
import { Download } from 'lucide-react'
import StatStrip from '@/components/layout/stat-strip'
import { AccentHeading } from '@/components/ui/accent-heading'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BrandAnalytics } from '@/lib/supabase/brand-analytics'
import { FunnelBars } from './funnel-bars'
import { LineChart } from './line-chart'

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/**
 * AnalyticsDashboard, the Enterprise-only brand analytics view: headline
 * tiles, the outreach funnel, a daily trend line, and a CSV export link.
 * Purely presentational; the gate and data fetch live in the server page.
 */
export function AnalyticsDashboard({ data }: { data: BrandAnalytics }) {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-medium font-medium text-muted-foreground">Brand analytics</p>
          <AccentHeading as="h1" className="mt-2 text-display">
            This billing period
          </AccentHeading>
          <p className="mt-3 max-w-[52ch] text-medium text-muted-foreground">
            {new Date(data.periodStart).toLocaleDateString()} to{' '}
            {new Date(data.periodEnd).toLocaleDateString()}
          </p>
        </div>
        <Link
          href="/api/brand/analytics/export"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        >
          <Download aria-hidden="true" />
          Download CSV
        </Link>
      </div>

      <section className="space-y-6">
        <AccentHeading as="h2" className="text-large">
          Your numbers
        </AccentHeading>
        <StatStrip
          stats={[
            { label: 'Connected athletes', value: data.connectedAthletes.toLocaleString() },
            { label: 'Reach (audience)', value: data.reachAudience.toLocaleString() },
            { label: 'Acceptance rate', value: formatPercent(data.acceptanceRate) },
            { label: 'Response rate', value: formatPercent(data.responseRate) },
          ]}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <AccentHeading as="h2" className="text-large">
            Outreach funnel
          </AccentHeading>
          <div className="mt-6">
            <FunnelBars
              requestsSent={data.funnel.requestsSent}
              accepted={data.funnel.accepted}
              messaged={data.funnel.messaged}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <AccentHeading as="h2" className="text-large">
            Requests sent, daily
          </AccentHeading>
          <div className="mt-6">
            <LineChart data={data.timeSeries.map((d) => ({ x: d.date, y: d.requestsSent }))} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <AccentHeading as="h2" className="text-large">
          Listings
        </AccentHeading>
        <StatStrip
          className="sm:grid-cols-2"
          stats={[
            { label: 'Active listings', value: data.listings.active.toLocaleString() },
            { label: 'Total listings', value: data.listings.total.toLocaleString() },
          ]}
        />
      </section>
    </div>
  )
}
