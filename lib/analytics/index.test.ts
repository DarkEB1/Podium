import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { track, isAnalyticsAllowed, registerProvider, hasProvider } from './index'
import { ANALYTICS_EVENTS } from './events'
import {
  acceptAllPreferences,
  rejectNonEssentialPreferences,
  writeConsentCookie,
  clearConsentCookie,
  type CookiePreferences,
} from '@/lib/legal/cookie-consent'

const CONSENTED = acceptAllPreferences()
const REFUSED = rejectNonEssentialPreferences()

describe('track', () => {
  let provider: ReturnType<typeof vi.fn>

  beforeEach(() => {
    provider = vi.fn()
    registerProvider(provider)
    clearConsentCookie()
  })

  afterEach(() => {
    registerProvider(null)
    clearConsentCookie()
  })

  // THE PECR REQUIREMENT: nothing fires before consent.
  it('does not fire when no consent has been recorded', () => {
    expect(track('signup_started', { role: 'athlete' })).toBe(false)
    expect(provider).not.toHaveBeenCalled()
  })

  it('does not fire when analytics were explicitly refused', () => {
    expect(track('signup_started', { role: 'athlete' }, { consent: REFUSED })).toBe(false)
    expect(provider).not.toHaveBeenCalled()
  })

  it('fires once analytics consent is given', () => {
    expect(track('signup_completed', { role: 'brand' }, { consent: CONSENTED })).toBe(true)
    expect(provider).toHaveBeenCalledWith('signup_completed', { role: 'brand' })
  })

  it('reads the consent cookie when no consent is passed', () => {
    writeConsentCookie(CONSENTED)
    expect(track('profile_published', { role: 'brand' })).toBe(true)

    clearConsentCookie()
    expect(track('profile_published', { role: 'brand' })).toBe(false)
  })

  it('does not fire on stale consent from a previous policy version', () => {
    const stale: CookiePreferences = { ...CONSENTED, version: 'v0-ancient' }
    expect(track('signup_started', {}, { consent: stale })).toBe(false)
  })

  it('does not fire on consent older than the re-ask window', () => {
    const old: CookiePreferences = { ...CONSENTED, updated_at: '2020-01-01T00:00:00.000Z' }
    expect(track('signup_started', {}, { consent: old })).toBe(false)
  })

  it('is a no-op when no provider is configured — the default', () => {
    registerProvider(null)
    expect(hasProvider()).toBe(false)
    expect(track('signup_started', {}, { consent: CONSENTED })).toBe(false)
  })

  it('redacts any PII that reaches it despite the typed catalogue', () => {
    // as never: deliberately widening past the event map to simulate a caller
    // passing a property the catalogue forbids.
    track('signup_completed', { role: 'brand', email: 'a@b.co' } as never, {
      consent: CONSENTED,
    })

    expect(provider).toHaveBeenCalledWith('signup_completed', {
      role: 'brand',
      email: '[redacted]',
    })
  })

  it('never throws when the provider throws', () => {
    registerProvider(() => {
      throw new Error('provider down')
    })
    expect(() => track('signup_started', {}, { consent: CONSENTED })).not.toThrow()
    expect(track('signup_started', {}, { consent: CONSENTED })).toBe(false)
  })
})

describe('isAnalyticsAllowed', () => {
  afterEach(() => clearConsentCookie())

  it('is false without consent and true with it', () => {
    expect(isAnalyticsAllowed({ consent: null })).toBe(false)
    expect(isAnalyticsAllowed({ consent: REFUSED })).toBe(false)
    expect(isAnalyticsAllowed({ consent: CONSENTED })).toBe(true)
  })
})

describe('event catalogue', () => {
  it('covers the core funnel end to end', () => {
    for (const required of [
      'signup_started',
      'signup_completed',
      'connection_request_sent',
      'connection_requests_viewed',
      'connection_request_responded',
      'proposal_sent',
      'payment_succeeded',
    ] as const) {
      expect(ANALYTICS_EVENTS).toContain(required)
    }
  })

  it('has no duplicate event names', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length)
  })
})
