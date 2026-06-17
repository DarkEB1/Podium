'use client'

import Link from 'next/link'
import { Plus, Minus, ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'

const faqs = [
  {
    q: 'Is it really free for athletes and teams?',
    a: 'One hundred percent free, forever. Athletes, teams, and agents never pay a penny — list your profile, message brands, sign contracts, and get paid with zero fees. Brands cover the cost, you keep the spotlight.',
  },
  {
    q: 'How do brands find me?',
    a: 'Brands search Podium by sport, location, audience size, and budget — your profile is your shop window. Keep it sharp with stats, highlights, and your availability, and the right sponsors come knocking. The stronger your profile, the higher you rank.',
  },
  {
    q: 'How do payments work?',
    a: 'Deals pay out directly from brand to athlete through Stripe — fast, secure, and traceable. Podium never sits between you and your money, so there are no payout fees on your side. You handle your own tax, we handle the plumbing.',
  },
  {
    q: 'Do I need an agent?',
    a: 'Nope — Podium cuts out the gatekeepers entirely. You deal with brands directly, on your terms, at your pace. Already have an agent? They can run your account for free too.',
  },
  {
    q: 'What sports are supported?',
    a: 'All of them. Football, athletics, rugby, netball, cycling, boxing, swimming, hockey, tennis, rowing — and plenty more. If you compete and have an audience, there is a brand on Podium for you.',
  },
  {
    q: 'How do I get verified?',
    a: 'Upload proof of your identity and competitive status, and our team reviews it within 48 hours. Once verified you get the blue badge that tells brands you are the real deal. Verified profiles win more deals, full stop.',
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
                    className="group/faq flex flex-1 items-center justify-between gap-4 px-8 py-6 text-left font-heading text-lg font-bold leading-snug text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary"
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
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg' })}>
            Get started free <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  )
}
