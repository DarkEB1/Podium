'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics'

/**
 * M-6 — records `connection_requests_viewed`, the funnel step that literally
 * could not happen before this page existed.
 *
 * Client-side because the consent gate lives in a first-party cookie the
 * browser owns; `track()` is a no-op until the visitor opts in, and a no-op
 * again when no provider is registered (the current default), so this renders
 * nothing and costs nothing.
 */
export default function TrackInboxView({ role, pending }: { role: string; pending: number }) {
  useEffect(() => {
    track('connection_requests_viewed', { role, pending })
  }, [role, pending])

  return null
}
