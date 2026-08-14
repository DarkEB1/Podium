import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAuditLogs } from '@/lib/supabase/admin'
import { AccentHeading } from '@/components/ui/accent-heading'
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
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Audit log</p>
        <AccentHeading as="h1" className="text-display">Audit log</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">The 100 most recent admin and system actions.</p>
      </div>

      {logs.length === 0 ? (
        <p className="mt-8 py-12 text-center text-medium text-muted-foreground">No audit entries yet.</p>
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
