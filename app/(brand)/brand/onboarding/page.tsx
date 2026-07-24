import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Set up your brand · Podium',
  description: 'Tell athletes and teams who you are and what you are looking for.',
  robots: { index: false },
}


export default function BrandOnboardingPage() {
  redirect('/brand/onboarding/step/1')
}
