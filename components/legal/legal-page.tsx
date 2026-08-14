/**
 * Shared presentation shell for the /terms, /privacy and /cookies pages.
 * Server component — pure layout, no data access.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AccentHeading } from '@/components/ui/accent-heading'

export function DraftNotice() {
  return (
    <div
      role="note"
      data-testid="legal-draft-notice"
      className="mt-8 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6"
    >
      <p className="font-heading text-base font-bold text-destructive">
        Draft, not yet reviewed by a solicitor
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        This document was prepared by Podium&apos;s engineering team so that the
        product has a good-faith, substantive policy in place during
        development. It has <strong>not</strong> been reviewed or approved by a
        qualified legal practitioner. It must be reviewed and signed off by a
        solicitor qualified in England and Wales, with particular attention to
        the provisions on minors, consumer rights, and data protection, before
        Podium accepts a single live user. Do not rely on it as legal advice.
      </p>
    </div>
  )
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-8">
      <h2 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground [&_a]:underline [&_a:hover]:text-foreground [&_li]:leading-relaxed [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

export function LegalPage({
  title,
  intro,
  version,
  effectiveDate,
  children,
}: {
  title: string
  intro: string
  version: string
  effectiveDate: string
  children: ReactNode
}) {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-16 md:py-16">
        <Link
          href="/"
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to Podium
        </Link>

        <AccentHeading as="h1" className="mt-8 text-display">
          {title}
        </AccentHeading>

        <p className="mt-4 text-sm text-muted-foreground">
          Version <strong className="text-foreground">{version}</strong> ·
          Effective <strong className="text-foreground">{effectiveDate}</strong>
        </p>

        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          {intro}
        </p>

        <DraftNotice />

        <div className="mt-12 space-y-12">{children}</div>
      </div>
    </main>
  )
}
