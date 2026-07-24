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
      title="We couldn't load your listings"
      description="Your listings are safe — we just couldn't fetch them. Try again."
      homeHref="/brand/dashboard"
    />
  )
}
