import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getTwoFactorStatus } from '@/lib/supabase/two-factor'
import TwoFactorChallenge from '@/components/admin/two-factor-challenge'
import TwoFactorSetup from '@/components/admin/two-factor-setup'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Two-factor authentication · Podium Admin',
  robots: { index: false, follow: false },
}

/**
 * 2.4 — the admin 2FA gate. Middleware sends any admin without a passed 2FA
 * cookie here. If they have never enrolled, they set it up; otherwise they are
 * challenged for a code. Both flows set the cookie on success.
 */
export default async function AdminTwoFactorPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'admin') redirect(ROUTES.forbidden)

  const admin = createAdminClient()
  const status = await getTwoFactorStatus(admin, user.id)

  return (
    <div className="mx-auto max-w-md px-6 py-16 md:py-24">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
        Two-factor authentication
      </h1>
      <div className="mt-6">
        {status.enabled ? <TwoFactorChallenge /> : <TwoFactorSetup />}
      </div>
    </div>
  )
}
