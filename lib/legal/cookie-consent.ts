/**
 * Cookie consent model (M-7 / CL-2).
 *
 * PECR reg. 6 requires opt-in BEFORE a non-essential cookie (or any equivalent
 * client-side storage) is set. The rules this module encodes:
 *
 *  - `necessary` is always true and cannot be switched off — it covers the
 *    Supabase auth session cookie, CSRF protection and this consent record.
 *  - `analytics` and `marketing` default to FALSE. Nothing here ever produces a
 *    pre-ticked box.
 *  - Rejecting is a single click, exactly like accepting (`rejectNonEssential`).
 *  - Consent is versioned. Bumping COOKIE_POLICY_VERSION invalidates every
 *    stored choice and the banner reappears.
 *  - Consent expires after 6 months (ICO guidance on re-asking), after which
 *    the banner reappears.
 *
 * The persisted value is a first-party cookie for everyone, plus a write to
 * `public.users.cookie_prefs` for signed-in users (see lib/supabase/settings.ts).
 */

import { COOKIE_POLICY_VERSION } from './versions'

export const COOKIE_CONSENT_COOKIE = 'podium_cookie_consent'

/** 6 months, in seconds — how long a recorded choice is honoured. */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182

/** Non-essential categories the user can control. */
export const OPTIONAL_COOKIE_CATEGORIES = ['analytics', 'marketing'] as const

export type OptionalCookieCategory = (typeof OPTIONAL_COOKIE_CATEGORIES)[number]
export type CookieCategory = 'necessary' | OptionalCookieCategory

export interface CookiePreferences {
  /** Always true. Strictly necessary cookies are exempt from consent. */
  necessary: true
  analytics: boolean
  marketing: boolean
  /** COOKIE_POLICY_VERSION at the time the choice was made. */
  version: string
  /** ISO-8601 UTC timestamp of the choice — the audit trail for the consent. */
  updated_at: string
}

/**
 * The state of the toggles BEFORE any choice is made. Non-essential categories
 * are off: this object must never be persisted as if it were a consent record.
 */
export const DEFAULT_COOKIE_PREFERENCES: Readonly<
  Pick<CookiePreferences, 'necessary' | 'analytics' | 'marketing'>
> = Object.freeze({ necessary: true, analytics: false, marketing: false })

export interface CookieCategoryDescriptor {
  id: CookieCategory
  label: string
  description: string
  /** Necessary cookies are locked on. */
  locked: boolean
}

export const COOKIE_CATEGORY_DESCRIPTORS: readonly CookieCategoryDescriptor[] = [
  {
    id: 'necessary',
    label: 'Strictly necessary',
    description:
      'Required for the site to work: keeping you signed in, protecting forms against cross-site request forgery, and remembering this cookie choice. These cannot be switched off.',
    locked: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description:
      'Helps us understand which pages are used and where people get stuck, so we can improve the product. Off unless you turn it on.',
    locked: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description:
      'Used to measure advertising campaigns and to show you Podium adverts on other sites. Off unless you turn it on.',
    locked: false,
  },
]

function nowIso(): string {
  return new Date().toISOString()
}

/** A complete opt-in to every category. */
export function acceptAllPreferences(): CookiePreferences {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
    version: COOKIE_POLICY_VERSION,
    updated_at: nowIso(),
  }
}

/** A complete rejection of every non-essential category. */
export function rejectNonEssentialPreferences(): CookiePreferences {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    version: COOKIE_POLICY_VERSION,
    updated_at: nowIso(),
  }
}

/** A granular choice from the preference panel. */
export function customPreferences(choice: {
  analytics: boolean
  marketing: boolean
}): CookiePreferences {
  return {
    necessary: true,
    analytics: choice.analytics === true,
    marketing: choice.marketing === true,
    version: COOKIE_POLICY_VERSION,
    updated_at: nowIso(),
  }
}

/**
 * Narrows unknown JSON (a cookie string or the `users.cookie_prefs` jsonb) to
 * CookiePreferences. Returns null for anything malformed — a malformed record
 * is treated as "no consent given", never as consent.
 */
export function parseCookiePreferences(raw: unknown): CookiePreferences | null {
  let value = raw

  if (typeof value === 'string') {
    if (value.length === 0) return null
    try {
      value = JSON.parse(decodeURIComponent(value))
    } catch {
      return null
    }
  }

  if (typeof value !== 'object' || value === null) return null

  const record = value as Record<string, unknown>
  if (typeof record.version !== 'string') return null
  if (typeof record.updated_at !== 'string') return null
  if (typeof record.analytics !== 'boolean') return null
  if (typeof record.marketing !== 'boolean') return null

  return {
    necessary: true,
    analytics: record.analytics,
    marketing: record.marketing,
    version: record.version,
    updated_at: record.updated_at,
  }
}

export function serializeCookiePreferences(prefs: CookiePreferences): string {
  return encodeURIComponent(JSON.stringify(prefs))
}

/**
 * True when a stored choice is still valid: right policy version, and made
 * within COOKIE_CONSENT_MAX_AGE_SECONDS. Anything else means "ask again".
 */
export function isConsentCurrent(
  prefs: CookiePreferences | null,
  now: Date = new Date()
): boolean {
  if (!prefs) return false
  if (prefs.version !== COOKIE_POLICY_VERSION) return false

  const recordedAt = Date.parse(prefs.updated_at)
  if (Number.isNaN(recordedAt)) return false

  const ageSeconds = (now.getTime() - recordedAt) / 1000
  if (ageSeconds < 0) return false
  return ageSeconds <= COOKIE_CONSENT_MAX_AGE_SECONDS
}

/**
 * THE GATE. Any code that wants to load a third-party script, set a tracking
 * pixel, or write non-essential storage must call this first and do nothing
 * when it returns false.
 *
 *   if (!isCategoryAllowed('analytics', prefs)) return
 *
 * Fails closed: no stored consent, stale consent or an unknown category all
 * return false. `necessary` is the only category allowed without consent.
 */
export function isCategoryAllowed(
  category: CookieCategory,
  prefs: CookiePreferences | null,
  now: Date = new Date()
): boolean {
  if (category === 'necessary') return true
  if (!isConsentCurrent(prefs, now)) return false
  if (category === 'analytics') return prefs!.analytics === true
  if (category === 'marketing') return prefs!.marketing === true
  return false
}

// ---------------------------------------------------------------------------
// Browser cookie access (first-party, no third party involved)
// ---------------------------------------------------------------------------

/** Reads the consent cookie. Returns null on the server or when unset. */
export function readConsentCookie(
  cookieString?: string
): CookiePreferences | null {
  const source =
    cookieString ?? (typeof document === 'undefined' ? '' : document.cookie)
  if (!source) return null

  for (const part of source.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE_CONSENT_COOKIE) {
      return parseCookiePreferences(rest.join('='))
    }
  }
  return null
}

/**
 * Writes the consent cookie. First-party, SameSite=Lax, Secure outside local
 * development, and deliberately NOT HttpOnly so the client-side gate can read
 * it before any script decides whether to load.
 */
export function writeConsentCookie(prefs: CookiePreferences): void {
  if (typeof document === 'undefined') return

  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; Secure'
      : ''

  document.cookie =
    `${COOKIE_CONSENT_COOKIE}=${serializeCookiePreferences(prefs)}` +
    `; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

/** Clears the stored choice, so the banner reappears. */
export function clearConsentCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}
