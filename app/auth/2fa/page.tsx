import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { isTwoFactorEnabled } from '@/lib/supabase/two-factor'
import TwoFactorChallenge from '@/components/admin/two-factor-challenge'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES, ROLE_DASHBOARD } from '@/lib/routes'
import type { AppRole } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Two-factor authentication · Podium',
  robots: { index: false, follow: false },
}

/**
 * The user 2FA challenge. Middleware sends any 2FA-enabled user here after
 * password sign-in until they pass the challenge for this session. If somehow
 * reached without 2FA enabled, we send the user on to their dashboard.
 */
export default async function UserTwoFactorPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const home = ROLE_DASHBOARD[user.role as AppRole] ?? ROUTES.home
  if (!(await isTwoFactorEnabled(createAdminClient(), user.id))) redirect(home)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <AccentHeading as="h1" className="text-display">
            Two-factor authentication
          </AccentHeading>
          <div className="mt-6">
            <TwoFactorChallenge verifyPath="/api/account/2fa/verify" redirectPath={home} />
          </div>
        </div>
      </div>
    </main>
  )
}
