'use client'

import Link from 'next/link'
import { Plus, Minus, ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'

/**
 * M-2 — answers audited for unevidenced claims. Removed: a guaranteed "within
 * 48 hours" verification turnaround we cannot yet meet, "verified profiles win
 * more deals" (a performance claim with no data behind it), "there is a brand
 * on Podium for you" (an outcome promise), and "free forever" (an unqualified
 * commitment about future pricing). Keep answers factual and checkable — under
 * the CAP Code an objective claim on a marketing page must be substantiated.
 */
const faqs = [
  {
    q: 'Is it really free for athletes and teams?',
    a: 'Yes. Athletes, teams and agents pay nothing to list a profile, message brands, agree a deal or get paid — there are no Podium fees on your side. Brand subscriptions fund the platform. If that ever changes we will tell you in advance, and you will never be charged without agreeing first.',
  },
  {
    q: 'How do brands find me?',
    a: 'Brands search by sport, level, location, audience size and budget, so your profile is your shop window. A complete profile — stats, highlights, availability and what you are looking for — gives the search more to match on than a sparse one.',
  },
  {
    q: 'How do payments work?',
    a: 'Deal payments run from the brand to you through Stripe, so they are traceable and you get a receipt. Podium does not take a cut of your deal. You are responsible for your own tax and National Insurance — we do not withhold anything on your behalf, and we cannot give tax advice.',
  },
  {
    q: 'Do I need an agent?',
    a: 'No. You can deal with brands directly, on your own terms. If you already have an agent, they can hold their own Podium account and manage your profile and deals with the permissions you grant them, at no cost to you.',
  },
  {
    q: 'What sports are supported?',
    a: 'Podium is sport-agnostic — football, athletics, rugby, netball, cycling, boxing, swimming, hockey, tennis, rowing and more. You choose your sport, position and level when you build your profile, from recreational through to international.',
  },
  {
    q: 'How do I get verified?',
    a: 'Upload proof of your identity and your competitive status and our team reviews it manually. We aim to turn reviews around quickly, and we will tell you if we need anything else. Verification shows brands we have checked those documents — it is not a guarantee of results.',
  },
]

export default function FAQ() {
  return (
    <section id="faq" className="border-t border-border bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-16 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            FAQ
          </p>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Questions? We&apos;ve got answers.
          </h2>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
            Everything you need to know before you step on the Podium.
          </p>
        </div>

        <Accordion className="mt-14 space-y-4">
          {faqs.map((f) => {
            const slug = f.q.slice(0, 30).replace(/\s+/g, '-').toLowerCase()
            return (
              <AccordionItem
                key={slug}
                value={slug}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors data-open:bg-muted/40 motion-reduce:transition-none"
              >
                <AccordionPrimitive.Header className="flex">
                  <AccordionPrimitive.Trigger
                    data-slot="accordion-trigger"
                    // A-4: this trigger had `outline-none` plus a colour-only
                    // focus change, so keyboard focus was invisible to anyone
                    // who cannot rely on hue — the exact finding the styled
                    // Accordion wrapper fixed, bypassed here by rendering the
                    // primitive directly. Same remedy as
                    // components/ui/accordion.tsx: a full-opacity 2px --ring
                    // (5.86:1 on --background, over the 3:1 non-text minimum)
                    // with a 2px offset so it reads on the card and the page.
                    className="group/faq flex flex-1 items-center justify-between gap-4 rounded-2xl px-8 py-6 text-left font-heading text-lg font-bold leading-snug text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {f.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-aria-expanded/faq:bg-primary group-aria-expanded/faq:text-primary-foreground">
                      <Plus className="size-4 group-aria-expanded/faq:hidden" strokeWidth={2} />
                      <Minus className="hidden size-4 group-aria-expanded/faq:block" strokeWidth={2} />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionContent className="px-8 text-base leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <p className="font-heading text-lg font-bold text-foreground">Still curious? The best way to learn is to dive in.</p>
          <Link href={ROUTES.auth.signUp} className={buttonVariants({ size: 'lg' })}>
            Get started free <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  )
}
