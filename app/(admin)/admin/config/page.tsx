import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = { title: 'System configuration · Podium Admin', robots: { index: false } }

// Integration -> the env vars it needs. We only ever report presence, never the
// value, so this page is safe to render. Fail-closed features are unavailable
// until their keys are set.
const INTEGRATIONS: { name: string; keys: string[] }[] = [
  { name: 'Supabase', keys: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] },
  { name: 'App URL', keys: ['NEXT_PUBLIC_APP_URL'] },
  { name: 'Stripe (subscriptions)', keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  { name: 'Stripe Connect (payouts)', keys: ['STRIPE_CONNECT_WEBHOOK_SECRET'] },
  { name: 'Email (Resend)', keys: ['RESEND_API_KEY', 'EMAIL_FROM'] },
  { name: 'Cron jobs', keys: ['CRON_SECRET'] },
  { name: 'Admin & user 2FA', keys: ['TWO_FACTOR_ENCRYPTION_KEY', 'ADMIN_2FA_COOKIE_SECRET'] },
  { name: 'One-click unsubscribe', keys: ['UNSUBSCRIBE_SECRET'] },
  { name: 'Push notifications', keys: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] },
  { name: 'Social OAuth (Meta)', keys: ['META_CLIENT_ID', 'META_CLIENT_SECRET'] },
  { name: 'Social OAuth (TikTok)', keys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'] },
  { name: 'Social OAuth (X)', keys: ['X_CLIENT_ID', 'X_CLIENT_SECRET'] },
  { name: 'Social OAuth (YouTube/Google)', keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { name: 'Social OAuth (LinkedIn)', keys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
  { name: 'E-signature provider', keys: ['ESIGNATURE_PROVIDER'] },
]

export default async function AdminConfigPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const rows = INTEGRATIONS.map((i) => ({
    name: i.name,
    configured: i.keys.every((k) => !!process.env[k]),
    keys: i.keys,
  }))

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Configuration</p>
        <AccentHeading as="h1" className="text-display">System configuration</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">
          Which integrations are configured in this environment. Only presence is shown, never a value.
        </p>
      </div>

      <ul className="mt-8 divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-medium text-foreground">{r.name}</p>
              <p className="text-small text-muted-foreground font-mono break-all">{r.keys.join(', ')}</p>
            </div>
            <span
              className={
                r.configured
                  ? 'shrink-0 rounded-full bg-success/15 px-3 py-1 text-small font-medium text-success'
                  : 'shrink-0 rounded-full bg-muted px-3 py-1 text-small font-medium text-muted-foreground'
              }
            >
              {r.configured ? 'Configured' : 'Not set'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
