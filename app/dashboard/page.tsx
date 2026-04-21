import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'

const ROLE_DASHBOARD: Record<string, string> = {
  athlete: '/athlete/dashboard',
  brand: '/brand/dashboard',
  team: '/team/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')
  const dest = user.role ? ROLE_DASHBOARD[user.role] : null
  redirect(dest ?? '/role-select')
}
