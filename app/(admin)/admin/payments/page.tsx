import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getRevenueOverview } from '@/lib/supabase/admin-insights'
import StatGrid from '@/components/admin/stat-grid'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Payments & revenue · Podium Admin', robots: { index: false } }

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const r = await getRevenueOverview(createAdminClient())
  const money = (n: number) => `£${n.toLocaleString()}`

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Payments & revenue</h1>
      <p className="mt-3 text-medium text-muted-foreground">Recent payments (last 500).</p>

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
              {p.currency} {Number(p.amount).toLocaleString()}
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
