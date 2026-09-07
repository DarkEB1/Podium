import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/layout/footer'
import { LegalPage, LegalSection } from '@/components/legal/legal-page'
import CookiePreferencesButton from '@/components/legal/cookie-preferences-button'
import { COOKIE_CATEGORY_DESCRIPTORS } from '@/lib/legal/cookie-consent'
import {
  CONTROLLER,
  COOKIE_POLICY_VERSION,
  POLICY_EFFECTIVE_DATE,
} from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Cookie Policy · Podium',
  description:
    'What cookies Podium sets, why, and how to accept, reject or change your choice at any time.',
  // WS-INFRA P2: one canonical URL, resolved against metadataBase in app/layout.tsx.
  alternates: { canonical: '/cookies' },
}

export default function CookiesPage() {
  return (
    <>
      <LegalPage
        title="Cookie Policy"
        version={COOKIE_POLICY_VERSION}
        effectiveDate={POLICY_EFFECTIVE_DATE}
        intro="Cookies are small files stored on your device. Under the Privacy and Electronic Communications Regulations we may only set cookies that are not strictly necessary if you have agreed to them first, so on Podium they stay off until you turn them on."
      >
        <LegalSection id="categories" heading="1. The categories we use">
          <div className="space-y-6">
            {COOKIE_CATEGORY_DESCRIPTORS.map((category) => (
              <div key={category.id}>
                <p className="font-semibold text-foreground">
                  {category.label}
                  {category.locked && (
                    <span className="ml-2 text-sm font-normal">
                      (always on, no consent required)
                    </span>
                  )}
                </p>
                <p className="mt-1">{category.description}</p>
              </div>
            ))}
          </div>
        </LegalSection>

        <LegalSection id="what-we-set" heading="2. What is actually set today">
          <p>
            <strong>Strictly necessary.</strong> An authentication cookie set by
            our authentication provider (Supabase) that keeps you signed in and
            is cleared when you sign out or it expires; and{' '}
            <code>podium_cookie_consent</code>, a first-party cookie that
            records the choice you make on this page so we do not have to ask
            again. It stores only your category choices, the policy version and
            the date, lasts six months, and is not shared with anyone.
          </p>
          <p>
            <strong>Analytics and marketing.</strong> Podium does not currently
            load any third-party analytics or advertising script. The consent
            mechanism and the switches are in place so that if we ever add one,
            it cannot load unless you have opted in first. If we add a named
            provider, we will list it here and ask for your consent again.
          </p>
          <p>
            We also use technologies similar to cookies, such as browser local
            storage, and we treat them under exactly the same rules.
          </p>
        </LegalSection>

        <LegalSection id="your-choice" heading="3. Changing your mind">
          <p>
            You can accept all, reject everything that is not strictly
            necessary, or choose category by category, and change that choice
            whenever you like. Rejecting is exactly as easy as accepting, and
            rejecting will not stop you using Podium.
          </p>
          <p>
            <CookiePreferencesButton className="font-semibold text-primary underline underline-offset-4 hover:text-foreground" />{' '}
            opens the preference panel. The same link sits in the footer of
            every page.
          </p>
          <p>
            If you are signed in, your choice is also saved to your account so
            it follows you between devices. If you clear your browser cookies we
            will ask you again.
          </p>
          <p>
            You can also block or delete cookies in your browser settings, but
            blocking strictly necessary cookies will stop you signing in.
          </p>
        </LegalSection>

        <LegalSection id="more" heading="4. More information">
          <p>
            How we use the personal data behind these cookies is covered in the{' '}
            <Link href="/privacy">Privacy Policy</Link>. Questions:{' '}
            <a href={`mailto:${CONTROLLER.privacyEmail}`}>
              {CONTROLLER.privacyEmail}
            </a>
            . This is version {COOKIE_POLICY_VERSION}; if we change the
            categories we use, we will publish a new version and ask you to
            choose again.
          </p>
        </LegalSection>
      </LegalPage>
      <Footer />
    </>
  )
}
