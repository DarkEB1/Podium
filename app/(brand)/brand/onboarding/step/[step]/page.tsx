import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BrandProfileForm from '@/components/brand/brand-profile-form'
import TrackOnboardingStep from '@/components/analytics/track-onboarding-step'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Set up your brand · Podium',
  description: 'Tell athletes and teams who you are and what you are looking for.',
  robots: { index: false },
}


type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

const VALID_STEPS = [1, 2, 3, 4]

const STEP_TITLES: Record<number, string> = {
  1: 'Company basics',
  2: 'Targeting',
  3: 'About your brand',
  4: 'Review & submit',
}

export default async function BrandOnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step: stepParam } = await params
  const step = Number(stepParam)
  if (!VALID_STEPS.includes(step)) redirect('/brand/onboarding/step/1')

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getOwnProfile returns the row for the given role table; cast narrows the union to BrandRow
  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null

  if (profile?.status === 'active') redirect('/brand/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <TrackOnboardingStep role="brand" step={step} />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Set up your brand: {STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandProfileForm step={step} profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
