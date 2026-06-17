import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import RoleSelectForm from '@/components/auth/role-select-form'
import type { Database } from '@/types/database'

type UserRole = Database['public']['Enums']['user_role']

const ROLE_DASHBOARD: Partial<Record<UserRole, string>> = {
  athlete: '/athlete/dashboard',
  brand: '/brand/dashboard',
  team: '/team/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

export default async function RoleSelectPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role && user.role_locked_at) redirect(ROLE_DASHBOARD[user.role] ?? '/')

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
          <RoleSelectForm />
        </div>
      </div>
    </main>
  )
}
