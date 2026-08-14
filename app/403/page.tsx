import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Access denied · Podium',
  description: 'You do not have permission to view this page.',
  robots: { index: false },
}


export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 md:px-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <p className="mb-6 text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Access denied
        </p>
        <h1 className="font-heading text-display font-extrabold leading-[1.02] tracking-tight text-foreground">
          403
        </h1>
        <p className="mt-4 text-medium text-muted-foreground">
          You don&apos;t have permission to access this page.
        </p>
        <Link href="/" className={buttonVariants({ size: 'lg', className: 'mt-8' })}>
          Go home
        </Link>
      </div>
    </main>
  )
}
