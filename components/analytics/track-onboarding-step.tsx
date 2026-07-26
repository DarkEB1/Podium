'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics'

/**
 * M-6 — records `onboarding_step_viewed`, the drop-off metric for the longest
 * flow in the product. Rendered by the server onboarding step pages, which know
 * both the role and the step number.
 *
 * Client-side because the consent gate lives in a first-party cookie the browser
 * owns; `track()` is a no-op until the visitor opts in, and a no-op again when
 * no provider is registered (the current default), so this renders nothing and
 * costs nothing.
 */
export default function TrackOnboardingStep({ role, step }: { role: string; step: number }) {
  useEffect(() => {
    track('onboarding_step_viewed', { role, step })
  }, [role, step])

  return null
}
