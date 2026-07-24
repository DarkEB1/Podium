import { describe, it, expect } from 'vitest'
import {
  TERMS_VERSION,
  PRIVACY_VERSION,
  COOKIE_POLICY_VERSION,
  isPolicyAcceptanceStale,
  needsPolicyReacceptance,
} from './versions'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

describe('policy versions (CL-5)', () => {
  it('exposes dated version constants', () => {
    expect(TERMS_VERSION).toMatch(ISO_DATE)
    expect(PRIVACY_VERSION).toMatch(ISO_DATE)
    expect(COOKIE_POLICY_VERSION).toMatch(ISO_DATE)
  })
})

describe('isPolicyAcceptanceStale', () => {
  const accepted = {
    terms_version: TERMS_VERSION,
    terms_accepted_at: '2026-07-20T10:00:00.000Z',
    privacy_version: PRIVACY_VERSION,
    privacy_accepted_at: '2026-07-20T10:00:00.000Z',
  }

  it('is not stale when both versions match and are timestamped', () => {
    expect(isPolicyAcceptanceStale(accepted)).toEqual({
      termsStale: false,
      privacyStale: false,
      stale: false,
    })
  })

  it('is stale for a user who has never accepted anything', () => {
    expect(needsPolicyReacceptance(null)).toBe(true)
    expect(
      isPolicyAcceptanceStale({
        terms_version: null,
        terms_accepted_at: null,
        privacy_version: null,
        privacy_accepted_at: null,
      }).stale
    ).toBe(true)
  })

  it('flags only the policy whose version has moved on', () => {
    const result = isPolicyAcceptanceStale({ ...accepted, terms_version: '2020-01-01' })
    expect(result.termsStale).toBe(true)
    expect(result.privacyStale).toBe(false)
    expect(result.stale).toBe(true)
  })

  it('treats a version without an acceptance timestamp as no consent', () => {
    const result = isPolicyAcceptanceStale({ ...accepted, privacy_accepted_at: null })
    expect(result.privacyStale).toBe(true)
    expect(result.stale).toBe(true)
  })
})
