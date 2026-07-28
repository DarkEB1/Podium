import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAuditLogs } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'Audit log · Podium Admin', robots: { index: false } }

/** The admin audit log (spec §admin). */
export default async function AdminAuditPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const logs = await getAuditLogs(createAdminClient(), { limit: 100 })

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Audit log</h1>
      <p className="mt-3 text-medium text-muted-foreground">The 100 most recent admin and system actions.</p>

      {logs.length === 0 ? (
        <p className="mt-8 text-medium text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-medium">
              <span className="text-foreground">
                {l.action} · <span className="text-muted-foreground">{l.target_type}</span>
              </span>
              <span className="text-small text-muted-foreground">
                {l.actor_id ? l.actor_id.slice(0, 8) : 'system'} · {new Date(l.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
