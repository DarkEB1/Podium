import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import SettingsForm from '@/components/athlete/settings-form'
import { AccentHeading } from '@/components/ui/accent-heading'
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

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-2">
        <AccentHeading as="h1" className="text-display">Settings</AccentHeading>
        <p className="text-medium text-muted-foreground">Manage your profile, visibility, notifications and account.</p>
      </header>
      <SettingsForm profile={profile} />
    </div>
  )
}
