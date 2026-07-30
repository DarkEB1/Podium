import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
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
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {failed ? 'That link didn’t work' : 'You’re unsubscribed'}
      </h1>
      <p className="mt-3 text-medium text-muted-foreground">
        {failed
          ? 'This unsubscribe link is invalid or has already been used. You can manage every email preference from your settings.'
          : 'You will no longer receive marketing emails from Podium. You can fine-tune every notification, including which service emails you receive, from your settings at any time.'}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={ROUTES.auth.signIn} className={buttonVariants()}>
          Go to Podium
        </Link>
      </div>
    </main>
  )
}
