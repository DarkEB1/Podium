import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle>Choose your role</CardTitle>
          <CardDescription>
            This is permanent and cannot be changed. Choose carefully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleSelectForm />
        </CardContent>
      </Card>
    </main>
  )
}
