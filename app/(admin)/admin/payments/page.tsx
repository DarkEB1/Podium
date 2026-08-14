import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getRevenueOverview } from '@/lib/supabase/admin-insights'
import StatGrid from '@/components/admin/stat-grid'
import { AccentHeading } from '@/components/ui/accent-heading'
import { formatMinorAmount } from '@/lib/money'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Payments & revenue · Podium Admin', robots: { index: false } }

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const r = await getRevenueOverview(createAdminClient())
  // ST-6: getRevenueOverview sums payments.amount / net_amount, which are
  // Stripe MINOR units. Printing them as pounds inflated every figure on this
  // dashboard by 100x.
  const money = (minor: number) => formatMinorAmount(minor, 'GBP')

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Payments</p>
        <AccentHeading as="h1" className="text-display">Payments & revenue</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">Recent payments (last 500).</p>
      </div>

      <div className="mt-8">
        <StatGrid
          stats={[
            { label: 'Gross', value: money(r.totalGross) },
            { label: 'Platform fees', value: money(r.totalPlatformFees) },
            { label: 'Net to payees', value: money(r.totalNet) },
          ]}
        />
      </div>

      <h2 className="mt-10 font-heading text-large font-semibold text-foreground">By status</h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {Object.entries(r.byStatus).map(([status, v]) => (
          <li key={status} className="rounded-full border border-border px-3 py-1 text-small text-foreground">
            {status}: {v.count} · {money(v.gross)}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-heading text-large font-semibold text-foreground">Recent payments</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {r.recent.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-medium">
            <span className="text-foreground">
              {formatMinorAmount(Number(p.amount), p.currency)}
            </span>
            <span className="text-small text-muted-foreground">
              {p.status} · {new Date(p.created_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
