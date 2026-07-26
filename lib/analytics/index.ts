/**
 * Funnel analytics (M-6) — consent-gated by construction.
 *
 * THE GATE IS THE POINT. PECR reg. 6 requires opt-in BEFORE any non-essential
 * client-side storage or third-party call; the cookie banner
 * (`lib/legal/cookie-consent.ts`) exists specifically to capture that choice.
 * So `track()` reads the stored consent record and does NOTHING unless
 * `isCategoryAllowed('analytics', prefs)` is true. It fails closed: no consent,
 * stale consent, malformed cookie, server-side render — all no-ops.
 *
 * It is also a no-op when no provider is registered, which is the current
 * default: there is no vendor, no script tag and no dependency. Wiring a
 * provider is `registerProvider(...)` in one place, and every already-placed
 * `track()` call starts reporting.
 *
 * Events are typed against `lib/analytics/events.ts`, and properties are
 * redacted with the observability redactor before they are handed to any
 * provider — so even a mis-typed property cannot ship an email address.
 */

import {
  isCategoryAllowed,
  readConsentCookie,
  type CookiePreferences,
} from '@/lib/legal/cookie-consent'
import { redactContext } from '@/lib/observability/redact'
import type { AnalyticsEvent, AnalyticsProps } from './events'

export type { AnalyticsEvent } from './events'
export { ANALYTICS_EVENTS } from './events'

/** A destination for consent-approved events. */
export type AnalyticsProvider = (
  event: AnalyticsEvent,
  props: Record<string, unknown>
) => void

let provider: AnalyticsProvider | null = null

/**
 * Registers the single destination. Call it from a client component that mounts
 * once (never at module scope on the server). Passing `null` removes it.
 */
export function registerProvider(next: AnalyticsProvider | null): void {
  provider = next
}

/** Test/debug helper. */
export function hasProvider(): boolean {
  return provider !== null
}

export interface TrackOptions {
  /**
   * Consent record to gate on. Defaults to the first-party consent cookie.
   * Injectable so server code and tests can supply it explicitly.
   */
  consent?: CookiePreferences | null
  /** Clock injection for consent-expiry checks. */
  now?: Date
}

/**
 * Records a funnel step. Safe to call from anywhere: it never throws, never
 * blocks, and never fires without consent.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  props: AnalyticsProps<E>,
  options: TrackOptions = {}
): boolean {
  try {
    if (!isAnalyticsAllowed(options)) return false
    if (!provider) return false

    // Defence in depth: the event catalogue forbids PII properties, but a
    // caller could still pass one through a widened type.
    provider(event, redactContext(props as unknown as Record<string, unknown>))
    return true
  } catch {
    // Measurement must never break the flow it is measuring.
    return false
  }
}

/**
 * The gate on its own — for callers that must decide whether to LOAD a provider
 * script at all (loading it is itself the non-essential act).
 */
export function isAnalyticsAllowed(options: TrackOptions = {}): boolean {
  const consent = options.consent !== undefined ? options.consent : readConsentCookie()
  return isCategoryAllowed('analytics', consent, options.now ?? new Date())
}
