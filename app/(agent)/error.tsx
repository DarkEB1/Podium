'use client'

// B-11 / UX-1 — segment error boundary. The raw error never reaches the user;
// RouteError logs it to console.error and shows fixed copy plus a retry.
import { RouteError } from '@/components/ui/route-error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="We couldn't load this page"
      description="Something went wrong on our side while loading your agent workspace. Try again. Nothing you entered has been lost."
      homeHref="/agent/dashboard"
    />
  )
}
