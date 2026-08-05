import { Suspense } from 'react'
import Link from 'next/link'
import SignUpPanel, { SignUpPanelFallback } from '@/components/auth/signup-panel'
import { ROUTES } from '@/lib/routes'

/**
 * M-3/PR-10: the landing CTAs diverge into `?role=brand` and `?role=athlete`.
 * The role is echoed in the page copy and carried through to the role step so
 * signup does not start from a blank slate.
 *
 * PERF: that role is read CLIENT-side, in SignUpPanel. Awaiting `searchParams`
 * here forced dynamic rendering, so the busiest public page in the funnel was
 * an uncached server render on every view while /pricing and /terms were
 * static. Keep this file free of `searchParams`, `cookies()` and `headers()`
 * or it silently becomes dynamic again.
 */
// M-1: per-route metadata. This page is public and indexable — see app/sitemap.ts.
export const metadata = {
  title: 'Create your account · Podium',
  description:
    'Join Podium free as an athlete, team or agent, or sign up as a brand to find the talent to back.',
  openGraph: {
    type: 'website',
    title: 'Create your Podium account',
    description: 'Free forever for athletes, teams and agents. Get discovered by brands.',
  },
}

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<SignUpPanelFallback />}>
          <SignUpPanel />
        </Suspense>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          Already have an account?{' '}
          <Link href={ROUTES.auth.signIn} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
