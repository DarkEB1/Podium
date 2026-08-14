import Link from 'next/link'
import CookieBanner from '@/components/legal/cookie-banner'
import CookiePreferencesButton from '@/components/legal/cookie-preferences-button'
import { CONTROLLER } from '@/lib/legal/versions'
import { ROUTES } from '@/lib/routes'

/**
 * Every href below has been verified to resolve to a real route or to an
 * anchor that exists on the landing page (`id="what-we-do"` in
 * components/landing/stage/panel-what.tsx, resolved by the hash handler in
 * components/landing/stage/stage.tsx). The previous `/#trust`, `/#about`,
 * `/#faq` and `/#who` links all pointed at sections that no longer exist and
 * have been removed. Do not add a link here before confirming its target
 * renders.
 */
const PRODUCT_LINKS = [
  { label: 'How it works', href: ROUTES.landing.howItWorks },
  { label: 'Pricing', href: ROUTES.pricing },
]

const ACCOUNT_LINKS = [
  { label: 'Sign in', href: '/auth' },
  { label: 'Create an account', href: '/auth/signup' },
]

const LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Cookie Policy', href: '/cookies' },
]

const linkClass = 'transition-colors hover:text-foreground'

export default function Footer() {
  return (
    <>
      <footer className="border-t border-border bg-background py-14">
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">
                Podium
              </span>
              <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                The UK marketplace where athletes, teams and brands find each
                other directly.
              </p>
            </div>

            <nav aria-label="Product" className="text-sm text-muted-foreground">
              <p className="font-heading text-sm font-bold text-foreground">
                Product
              </p>
              <ul className="mt-3 space-y-2">
                {PRODUCT_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account" className="text-sm text-muted-foreground">
              <p className="font-heading text-sm font-bold text-foreground">
                Account
              </p>
              <ul className="mt-3 space-y-2">
                {ACCOUNT_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  {/* A real page with a form — the mailto link did nothing on
                      devices without a configured mail client. */}
                  <Link href="/contact" className={linkClass}>
                    Contact us
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Legal" className="text-sm text-muted-foreground">
              <p className="font-heading text-sm font-bold text-foreground">
                Legal
              </p>
              <ul className="mt-3 space-y-2">
                {LEGAL_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  {/* Consent must be as easy to withdraw as it was to give. */}
                  <CookiePreferencesButton className={linkClass} />
                </li>
              </ul>
            </nav>
          </div>

          <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
            © 2026 Podium. All rights reserved. Podium is an introduction
            platform and is not a party to agreements made between brands and
            athletes or teams.
          </p>
        </div>
      </footer>

      {/*
        Mounted here so consent is reachable from every page that renders the
        footer. For site-wide coverage the banner should also be mounted once in
        app/layout.tsx — see the handover note in the task report.
      */}
      <CookieBanner />
    </>
  )
}
