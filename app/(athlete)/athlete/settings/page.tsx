import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import SettingsForm from '@/components/athlete/settings-form'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Settings · Podium',
  description: 'Manage your Podium account, notifications and privacy.',
  robots: { index: false },
}


type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

export default async function AthleteSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = (await getOwnProfile(supabase, user.id, 'athlete')) as AthleteRow | null
  if (!profile) redirect('/athlete/onboarding')

  // SettingsForm renders SettingsShell, which owns the page container, the
  // "Settings" H1, the section nav and Sign-out. Wrapping it in an extra
  // max-w-2xl container (as this page used to) squished the shell's two-column
  // grid and duplicated the heading — the double-wrap defect.
  return <SettingsForm profile={profile} />
}
