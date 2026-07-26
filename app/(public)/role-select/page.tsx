import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import RoleSelectForm from '@/components/auth/role-select-form'
import { parseRole } from '@/components/auth/intended-role'
import { ROUTES, ROLE_DASHBOARD as ROLE_HOME } from '@/lib/routes'
import type { Database } from '@/types/database'

type UserRole = Database['public']['Enums']['user_role']

const ROLE_DASHBOARD: Partial<Record<UserRole, string>> = {
  ...ROLE_HOME,
  admin: '/admin/dashboard',
}

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Choose your role · Podium',
  description: 'Tell us whether you are an athlete, team, agent or brand.',
  robots: { index: false, follow: false },
}

export default async function RoleSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role && user.role_locked_at) redirect(ROLE_DASHBOARD[user.role] ?? ROUTES.home)

  const { role: roleParam } = await searchParams
  const initialRole = parseRole(roleParam)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Choose your role
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            This is permanent and cannot be changed. Choose carefully.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <RoleSelectForm {...(initialRole ? { initialRole } : {})} />
        </div>
      </div>
    </main>
  )
}
