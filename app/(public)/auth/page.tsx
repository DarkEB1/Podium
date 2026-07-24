import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import LoginForm from '@/components/auth/login-form'
import { authErrorMessage } from '@/components/auth/auth-errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ROUTES } from '@/lib/routes'

/**
 * The sign-in page. B-3/NX-1: the auth callback redirects failures here with
 * `?error=<code>`; the code is translated to human copy and rendered above the
 * form so the user learns why their link did not work.
 */
// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Sign in · Podium',
  description: 'Sign in to your Podium account to manage your profile, connections and deals.',
  robots: { index: false, follow: true },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = authErrorMessage(error)

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

        {message ? (
          <Alert variant="destructive" className="mb-6" data-testid="auth-error">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>We couldn&apos;t complete that link</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

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
