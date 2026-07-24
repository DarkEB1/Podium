'use client'

/**
 * Cookie consent banner (M-7 / CL-2).
 *
 * PECR compliance notes for future editors:
 *  - Nothing non-essential may be loaded until `useCookieConsent().allows(...)`
 *    returns true. The banner never sets an analytics/marketing cookie itself.
 *  - "Reject non-essential" sits beside "Accept all", same size, same visual
 *    weight, same number of clicks. Do not demote it to a text link.
 *  - The optional switches start OFF. Never pre-tick them.
 *  - The banner does not block the page, but it persists until a choice is
 *    made — dismissing without choosing is not an option, because silence is
 *    not consent.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  COOKIE_CATEGORY_DESCRIPTORS,
  DEFAULT_COOKIE_PREFERENCES,
} from '@/lib/legal/cookie-consent'
import { hydrateConsent, useCookieConsent } from './cookie-consent-store'

export default function CookieBanner() {
  const {
    preferences,
    panelOpen,
    shouldShowBanner,
    acceptAll,
    rejectNonEssential,
    save,
    openPreferences,
    closePreferences,
  } = useCookieConsent()

  // Draft toggles for the granular panel. Seeded from the stored choice when
  // reopening preferences, otherwise from the all-off defaults.
  const [analytics, setAnalytics] = useState(DEFAULT_COOKIE_PREFERENCES.analytics)
  const [marketing, setMarketing] = useState(DEFAULT_COOKIE_PREFERENCES.marketing)

  useEffect(() => {
    hydrateConsent()
  }, [])

  useEffect(() => {
    if (panelOpen) {
      setAnalytics(preferences?.analytics ?? DEFAULT_COOKIE_PREFERENCES.analytics)
      setMarketing(preferences?.marketing ?? DEFAULT_COOKIE_PREFERENCES.marketing)
    }
  }, [panelOpen, preferences])

  const visible = shouldShowBanner || panelOpen
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 shadow-lg backdrop-blur md:p-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div>
          <p className="font-heading text-base font-bold text-foreground">
            Your cookie choices
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We use cookies that are strictly necessary to run Podium — keeping
            you signed in and keeping the site secure. We would also like to set
            optional analytics and marketing cookies, but only if you agree.
            They stay off until you say otherwise. Read our{' '}
            <Link href="/cookies" className="underline hover:text-foreground">
              Cookie Policy
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {panelOpen && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
            {COOKIE_CATEGORY_DESCRIPTORS.map((category) => {
              const checked =
                category.id === 'necessary'
                  ? true
                  : category.id === 'analytics'
                    ? analytics
                    : marketing

              return (
                <div
                  key={category.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {category.label}
                      {category.locked && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Always on
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <Switch
                    aria-label={category.label}
                    checked={checked}
                    disabled={category.locked}
                    onCheckedChange={(next: boolean) => {
                      if (category.id === 'analytics') setAnalytics(next)
                      if (category.id === 'marketing') setMarketing(next)
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {panelOpen ? (
            <>
              <Button
                variant="outline"
                onClick={closePreferences}
                className="sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => save({ analytics, marketing })}
                className="sm:w-auto"
              >
                Save my choices
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={openPreferences}
                className="sm:w-auto"
              >
                Manage preferences
              </Button>
              {/* Reject and Accept are deliberately identical in prominence. */}
              <Button
                variant="outline"
                onClick={rejectNonEssential}
                className="sm:w-auto"
              >
                Reject non-essential
              </Button>
              <Button onClick={acceptAll} className="sm:w-auto">
                Accept all
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
