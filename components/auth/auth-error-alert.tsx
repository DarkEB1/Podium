'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { authErrorMessage } from '@/components/auth/auth-errors'

/**
 * B-3/NX-1 — the auth callback redirects failures to the sign-in page with
 * `?error=<code>`; the code is translated to human copy and shown above the
 * form so the user learns why their link did not work.
 *
 * PERF: read on the client. Awaiting `searchParams` in the page forced dynamic
 * rendering, so sign-in was an uncached server render on every view. The alert
 * is the only part of the page that depends on the query, and it appears on a
 * small minority of visits, so the page prerenders and this fills in.
 *
 * `useSearchParams` requires a <Suspense> boundary in a prerendered page.
 */
export default function AuthErrorAlert() {
  const message = authErrorMessage(useSearchParams().get('error'))
  if (!message) return null

  return (
    <Alert variant="destructive" className="mb-6" data-testid="auth-error">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>We couldn&apos;t complete that link</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
