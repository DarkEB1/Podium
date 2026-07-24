import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

// B-11 / UX-1 — app-wide 404. Mirrors app/403/page.tsx so a missing route reads
// as a designed state rather than a framework default.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 md:px-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-card">
        <p className="mb-6 text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Not found
        </p>
        <h1 className="font-heading text-display font-extrabold leading-[1.02] tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-4 text-medium text-muted-foreground">
          That page has moved or never existed.
        </p>
        <Link href="/" className={buttonVariants({ size: 'lg', className: 'mt-8' })}>
          Go home
        </Link>
      </div>
    </main>
  )
}
