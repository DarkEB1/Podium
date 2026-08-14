import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { AccentHeading } from '@/components/ui/accent-heading'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Email preferences updated · Podium',
  description: 'Your email preferences have been updated.',
  robots: { index: false },
}

/**
 * Confirmation landing for the one-click unsubscribe link (CL-4). Public: the
 * user follows it from a mail client with no session. The actual change is
 * performed by /api/unsubscribe against the signed token before this renders.
 */
export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const failed = error === 'invalid'

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <AccentHeading as="h1" className="text-display">
            {failed ? 'That link didn’t work' : 'You’re unsubscribed'}
          </AccentHeading>
          <p className="mt-3 text-medium text-muted-foreground">
            {failed
              ? 'This unsubscribe link is invalid or has already been used. You can manage every email preference from your settings.'
              : 'You will no longer receive marketing emails from Podium. You can fine-tune every notification, including which service emails you receive, from your settings at any time.'}
          </p>
          <Link href={ROUTES.auth.signIn} className={cn(buttonVariants(), 'mt-8')}>
            Go to Podium
          </Link>
        </div>
      </div>
    </main>
  )
}
