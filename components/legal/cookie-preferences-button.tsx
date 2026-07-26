'use client'

/**
 * "Cookie preferences" trigger for the footer (M-7 / CL-2).
 *
 * PECR/GDPR requires that consent be as easy to withdraw as it was to give, so
 * this must remain reachable from every page that renders the footer.
 */

import { openCookiePreferences } from './cookie-consent-store'

export default function CookiePreferencesButton({
  className,
}: {
  className?: string
}) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      Cookie preferences
    </button>
  )
}
