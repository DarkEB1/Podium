import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getReports } from '@/lib/supabase/admin'
import ReportResolveButtons from '@/components/admin/report-resolve-buttons'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Trust & safety · Podium Admin', robots: { index: false } }

/** The reports / trust queue (spec §admin). */
export default async function AdminReportsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const reports = await getReports(createAdminClient(), { status: 'pending' })

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Trust & safety</h1>
      <p className="mt-3 text-medium text-muted-foreground">{reports.length} reports awaiting review.</p>

      {reports.length === 0 ? (
        <p className="mt-8 text-medium text-muted-foreground">No open reports.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="text-medium text-foreground">{r.reason.replace(/_/g, ' ')}</p>
                <p className="mt-1 text-small text-muted-foreground">
                  {r.reported_user_id ? `User ${r.reported_user_id}` : `Message ${r.reported_message_id}`} ·{' '}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <ReportResolveButtons reportId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
