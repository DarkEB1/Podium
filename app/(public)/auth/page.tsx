import { Suspense } from 'react'
import Link from 'next/link'

import LoginForm from '@/components/auth/login-form'
import AuthErrorAlert from '@/components/auth/auth-error-alert'
import { ROUTES } from '@/lib/routes'

/**
 * The sign-in page.
 *
 * PERF: the `?error=` code is read CLIENT-side, in AuthErrorAlert. Awaiting
 * `searchParams` here forced dynamic rendering, so this page was an uncached
 * server render on every view. Keep this file free of `searchParams`,
 * `cookies()` and `headers()` or it silently becomes dynamic again.
 */
// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Sign in · Podium',
  description: 'Sign in to your Podium account to manage your profile, connections and deals.',
  robots: { index: false, follow: true },
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            Sign in to your Podium account
          </p>
        </div>

        {/* No fallback: the alert is absent on the overwhelming majority of
            visits, so rendering nothing while the query is read is correct. */}
        <Suspense fallback={null}>
          <AuthErrorAlert />
        </Suspense>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          New to Podium?{' '}
          <Link href={ROUTES.auth.signUp} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
