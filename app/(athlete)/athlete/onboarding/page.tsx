import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Set up your profile · Podium',
  description: 'Build the profile brands and agents will discover you by.',
  robots: { index: false },
}


export default function OnboardingPage() {
  redirect('/athlete/onboarding/step/1')
}
