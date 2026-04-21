import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import SettingsForm from '@/components/athlete/settings-form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

export default async function AthleteSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = (await getOwnProfile(supabase, user.id, 'athlete')) as AthleteRow | null
  if (!profile) redirect('/athlete/onboarding')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm profile={profile} />
    </div>
  )
}
