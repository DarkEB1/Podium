import type { Metadata } from 'next'
import Footer from '@/components/layout/footer'
import ContactForm from '@/components/contact/contact-form'
import { CONTROLLER } from '@/lib/legal/versions'

// M-1: public and indexable, like the other (public) marketing pages.
export const metadata: Metadata = {
  title: 'Contact us · Podium',
  description:
    'Questions about Podium, your account or a partnership? Send us a message and we will get back to you.',
}

export default function ContactPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-xl px-6 py-16 md:px-10">
        <header className="mb-10 space-y-2">
          <p className="text-small font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Contact
          </p>
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Talk to us
          </h1>
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
