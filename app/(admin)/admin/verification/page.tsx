import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { listPendingVerifications } from '@/lib/supabase/verification'
import VerificationReviewButtons from '@/components/admin/verification-review-buttons'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Verification queue · Podium Admin',
  robots: { index: false },
}

/** The admin verification review queue (spec §trust). */
export default async function AdminVerificationPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const pending = await listPendingVerifications(createAdminClient())

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Verification</p>
        <AccentHeading as="h1" className="text-display">Verification queue</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">{pending.length} awaiting review</p>
      </div>

      {pending.length === 0 ? (
        <p className="mt-8 py-12 text-center text-medium text-muted-foreground">Nothing to review right now.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border">
          {pending.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="text-medium text-foreground">
                  {r.role} · <span className="font-mono text-small text-muted-foreground">{r.user_id}</span>
                </p>
                {r.note && <p className="mt-1 text-small text-muted-foreground">{r.note}</p>}
                <p className="mt-1 text-small text-muted-foreground">
                  Requested {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <VerificationReviewButtons requestId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
