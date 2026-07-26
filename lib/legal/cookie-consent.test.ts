import { describe, it, expect, beforeEach } from 'vitest'
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  DEFAULT_COOKIE_PREFERENCES,
  acceptAllPreferences,
  clearConsentCookie,
  customPreferences,
  isCategoryAllowed,
  isConsentCurrent,
  parseCookiePreferences,
  readConsentCookie,
  rejectNonEssentialPreferences,
  serializeCookiePreferences,
  writeConsentCookie,
} from './cookie-consent'
import { COOKIE_POLICY_VERSION } from './versions'

describe('default preferences (PECR: no pre-ticked boxes)', () => {
  it('has every non-essential category switched off', () => {
    expect(DEFAULT_COOKIE_PREFERENCES.necessary).toBe(true)
    expect(DEFAULT_COOKIE_PREFERENCES.analytics).toBe(false)
    expect(DEFAULT_COOKIE_PREFERENCES.marketing).toBe(false)
  })
})

describe('preference builders', () => {
  it('accept all opts into every category', () => {
    const prefs = acceptAllPreferences()
    expect(prefs).toMatchObject({ necessary: true, analytics: true, marketing: true })
    expect(prefs.version).toBe(COOKIE_POLICY_VERSION)
  })

  it('reject leaves only strictly necessary on', () => {
    const prefs = rejectNonEssentialPreferences()
    expect(prefs).toMatchObject({ necessary: true, analytics: false, marketing: false })
  })

  it('custom preferences coerce non-booleans to false rather than true', () => {
    const prefs = customPreferences({
      analytics: 'yes' as unknown as boolean,
      marketing: true,
    })
    expect(prefs.analytics).toBe(false)
    expect(prefs.marketing).toBe(true)
  })
})

describe('parseCookiePreferences', () => {
  it('round-trips a serialised record', () => {
    const prefs = acceptAllPreferences()
    expect(parseCookiePreferences(serializeCookiePreferences(prefs))).toEqual(prefs)
  })

  it('parses a jsonb object from users.cookie_prefs', () => {
    const prefs = rejectNonEssentialPreferences()
    expect(parseCookiePreferences({ ...prefs })).toEqual(prefs)
  })

  it.each([
    ['null', null],
    ['empty string', ''],
    ['garbage', 'not-json'],
    ['missing version', { analytics: true, marketing: true, updated_at: 'x' }],
    ['non-boolean flags', { analytics: 'true', marketing: false, version: 'v', updated_at: 'x' }],
  ])('returns null for %s rather than assuming consent', (_label, input) => {
    expect(parseCookiePreferences(input)).toBeNull()
  })
})

describe('isConsentCurrent', () => {
  const now = new Date('2026-07-20T12:00:00.000Z')

  it('accepts a fresh record on the current policy version', () => {
    expect(
      isConsentCurrent(
        { ...acceptAllPreferences(), updated_at: now.toISOString() },
        now
      )
    ).toBe(true)
  })

  it('rejects a record made against an older policy version', () => {
    expect(
      isConsentCurrent(
        { ...acceptAllPreferences(), version: '2020-01-01' },
        now
      )
    ).toBe(false)
  })

  it('expires consent older than the max age', () => {
    const old = new Date(
      now.getTime() - (COOKIE_CONSENT_MAX_AGE_SECONDS + 60) * 1000
    ).toISOString()
    expect(
      isConsentCurrent({ ...acceptAllPreferences(), updated_at: old }, now)
    ).toBe(false)
  })

  it('rejects null', () => {
    expect(isConsentCurrent(null, now)).toBe(false)
  })
})

describe('isCategoryAllowed (the gate)', () => {
  const now = new Date('2026-07-20T12:00:00.000Z')

  it('always allows strictly necessary, even with no consent on record', () => {
    expect(isCategoryAllowed('necessary', null, now)).toBe(true)
  })

  it('blocks analytics and marketing before any choice is made', () => {
    expect(isCategoryAllowed('analytics', null, now)).toBe(false)
    expect(isCategoryAllowed('marketing', null, now)).toBe(false)
  })

  it('blocks non-essential categories after a rejection', () => {
    const prefs = { ...rejectNonEssentialPreferences(), updated_at: now.toISOString() }
    expect(isCategoryAllowed('analytics', prefs, now)).toBe(false)
    expect(isCategoryAllowed('marketing', prefs, now)).toBe(false)
  })

  it('allows only the categories explicitly opted into', () => {
    const prefs = {
      ...customPreferences({ analytics: true, marketing: false }),
      updated_at: now.toISOString(),
    }
    expect(isCategoryAllowed('analytics', prefs, now)).toBe(true)
    expect(isCategoryAllowed('marketing', prefs, now)).toBe(false)
  })

  it('fails closed once consent has gone stale', () => {
    const prefs = { ...acceptAllPreferences(), version: '2020-01-01' }
    expect(isCategoryAllowed('analytics', prefs, now)).toBe(false)
  })
})

describe('cookie read/write', () => {
  beforeEach(() => {
    clearConsentCookie()
  })

  it('writes and reads back a first-party consent cookie', () => {
    const prefs = customPreferences({ analytics: true, marketing: false })
    writeConsentCookie(prefs)

    expect(document.cookie).toContain(COOKIE_CONSENT_COOKIE)
    expect(readConsentCookie()).toEqual(prefs)
  })

  it('reads from an explicit cookie string', () => {
    const prefs = acceptAllPreferences()
    const raw = `other=1; ${COOKIE_CONSENT_COOKIE}=${serializeCookiePreferences(prefs)}`
    expect(readConsentCookie(raw)).toEqual(prefs)
  })

  it('returns null when no consent cookie is present', () => {
    expect(readConsentCookie('other=1; another=2')).toBeNull()
  })
})
