import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { listActiveSessions, listLoginHistory } from '@/lib/supabase/sessions'
import { getLatestDataExport } from '@/lib/supabase/data-export'
import SessionList from '@/components/settings/session-list'
import DataExportSection from '@/components/settings/data-export-section'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Security · Podium',
  description: 'Your active sessions and recent sign-in activity.',
  robots: { index: false },
}

/** Account security: active sessions (with revoke) and recent login history. */
export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const [sessions, history, latestExport] = await Promise.all([
    listActiveSessions(supabase, user.id),
    listLoginHistory(supabase, user.id, 10),
    getLatestDataExport(supabase, user.id),
  ])

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 md:px-10 md:py-16">
      <header className="mb-8">
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">Security</h1>
        <p className="mt-3 text-medium text-muted-foreground">
          Devices signed in to your account, and recent sign-in activity.
        </p>
      </header>

      <SessionList
        sessions={sessions.map((s) => ({
          id: s.id,
          deviceLabel: s.device_label,
          ip: s.ip_address,
          lastActiveAt: s.last_active_at,
        }))}
      />

      <section className="mt-12">
        <h2 className="font-heading text-large font-semibold text-foreground">Recent sign-ins</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-medium text-muted-foreground">No sign-in activity recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-medium">
                <span className={h.success ? 'text-foreground' : 'text-destructive'}>
                  {h.success ? 'Successful sign-in' : 'Failed attempt'}
                </span>
                <span className="text-small text-muted-foreground">
                  {new Date(h.created_at).toLocaleString()}
                  {h.ip_address ? ` · ${h.ip_address}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DataExportSection
        initialStatus={latestExport?.status ?? null}
        downloadUrl={latestExport?.download_url ?? null}
        expiresAt={latestExport?.expires_at ?? null}
      />
    </main>
  )
}
