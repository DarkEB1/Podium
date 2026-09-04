import type { Metadata } from 'next'
import Footer from '@/components/layout/footer'
import ContactForm from '@/components/contact/contact-form'
import { AccentHeading } from '@/components/ui/accent-heading'
import { CONTROLLER } from '@/lib/legal/versions'

// M-1: public and indexable, like the other (public) marketing pages.
export const metadata: Metadata = {
  title: 'Contact us · Podium',
  description:
    'Questions about Podium, your account or a partnership? Send us a message and we will get back to you.',
  // WS-INFRA P2: one canonical URL, resolved against metadataBase in app/layout.tsx.
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12 md:px-16 md:py-16">
        <header className="mb-10 space-y-2">
          <p className="text-small font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Contact
          </p>
          <AccentHeading as="h1" className="text-display">
            Talk to us
          </AccentHeading>
          <p className="text-medium text-muted-foreground">
            Questions, feedback or a partnership idea? Send a message and it
            lands straight in our inbox. Prefer email? Write to{' '}
            <a className="font-medium text-primary hover:underline" href={`mailto:${CONTROLLER.supportEmail}`}>
              {CONTROLLER.supportEmail}
            </a>
            .
          </p>
        </header>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
