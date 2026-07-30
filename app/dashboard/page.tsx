import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Dashboard · Podium',
  description: 'Your Podium home. Jump back into your role dashboard.',
  robots: { index: false },
}


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
