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
    <section id="faq" className="border-b border-border bg-muted/30 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-heading text-small font-semibold text-muted-foreground shadow-card">
            FAQ
          </span>
          <h2 className="mt-5 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Questions? We&apos;ve got answers
          </h2>
          <p className="mx-auto mt-4 max-w-md text-medium leading-relaxed text-muted-foreground">
            Everything you need to know before you step on the Podium.
          </p>
        </div>

        <Accordion className="space-y-4">
          {faqs.map((f) => {
            const slug = f.q.slice(0, 30).replace(/\s+/g, '-').toLowerCase()
            return (
              <AccordionItem
                key={slug}
                value={slug}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover data-open:bg-accent/5 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <AccordionPrimitive.Header className="flex">
                  <AccordionPrimitive.Trigger
                    data-slot="accordion-trigger"
                    className="group/faq flex flex-1 items-center justify-between gap-4 px-6 py-5 text-left font-heading text-medium font-bold leading-snug outline-none transition-colors hover:text-primary focus-visible:text-primary md:text-lg"
                  >
                    {f.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-aria-expanded/faq:bg-accent/15 group-aria-expanded/faq:text-foreground">
                      <Plus className="size-4 group-aria-expanded/faq:hidden" strokeWidth={2} />
                      <Minus className="hidden size-4 group-aria-expanded/faq:block" strokeWidth={2} />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionContent className="px-6 text-medium leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="font-heading text-medium font-bold">Still curious? The best way to learn is to dive in.</p>
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg' })}>
            Get started free <ArrowRight className="ml-1 h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  )
}
