'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  { q: 'Is Podium really free for athletes and teams?', a: 'Yes. Athletes, teams, and agents never pay. All features — listing, searching, messaging, deal proposals, contracts, and payments — are completely free and unlimited.' },
  { q: 'How does brand pricing work?', a: 'Brands pay a monthly subscription at Tier 1, Tier 2, or Tier 3. All tiers include a 7-day free trial with no charge during the trial period.' },
  { q: 'How do e-signatures work?', a: 'Contracts are signed digitally via our integrated e-signature provider. Each signature is logged with a full audit trail including IP address, device, and timestamp.' },
  { q: 'How are payments processed?', a: 'Payments go directly from brand to athlete or team via Stripe. Podium is not the employer or payroll agent — athletes and teams are responsible for their own tax obligations.' },
  { q: 'What happens if I need to report a user?', a: 'Use the three-dot menu on any profile or message to file a report. All reports are reviewed by our admin team within 48 hours.' },
  { q: 'How do I delete my account?', a: 'Go to Settings → Account → Delete Account. You have a 14-day grace period to change your mind. Your data is permanently deleted after that (except retained payment records, as required by law).' },
]

export default function FAQ() {
  return (
    <section id="faq" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="mb-10 text-center text-3xl font-bold">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f) => {
            const slug = f.q.slice(0, 30).replace(/\s+/g, '-').toLowerCase()
            return (
            <AccordionItem key={slug} value={slug} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="text-left font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </section>
  )
}
