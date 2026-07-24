import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import ProfileWizard from '@/components/athlete/profile-wizard'
import TrackOnboardingStep from '@/components/analytics/track-onboarding-step'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Set up your profile · Podium',
  description: 'Build the profile brands and agents will discover you by.',
  robots: { index: false },
}


type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const VALID_STEPS = [1, 2, 3, 4, 5, 6]

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step: stepParam } = await params
  const step = Number(stepParam)
  if (!VALID_STEPS.includes(step)) redirect('/athlete/onboarding/step/1')

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'athlete') as AthleteRow | null

  if (profile?.status === 'active') redirect('/athlete/dashboard')

  const STEP_TITLES: Record<number, string> = {
    1: 'Basic info',
    2: 'Your sport',
    3: 'Availability',
    4: 'Social & bio',
    5: 'Guardian details',
    6: 'Review & publish',
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-6 py-12 md:px-16 md:py-16">
      <TrackOnboardingStep role="athlete" step={step} />
      <header className="mb-10 space-y-2">
        <p className="text-small font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Set up your profile
        </p>
        <h1 className="text-display text-foreground">{STEP_TITLES[step]}</h1>
      </header>
      <ProfileWizard step={step} profile={profile} />
    </div>
  )
}
