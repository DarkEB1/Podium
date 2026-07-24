import { describe, it, expect } from 'vitest'
import { redact, redactContext, redactString, REDACTED } from './redact'

describe('redactString', () => {
  it('removes email addresses anywhere in the text', () => {
    expect(redactString('failed for nicholas@example.com while saving')).toBe(
      `failed for ${REDACTED} while saving`
    )
  })

  it('removes bearer tokens', () => {
    expect(redactString('Authorization: Bearer abc.def-123')).toContain(REDACTED)
    expect(redactString('Authorization: Bearer abc.def-123')).not.toContain('abc.def')
  })

  it('removes Stripe-shaped keys', () => {
    expect(redactString('using sk_live_1234567890abcdef')).toBe(`using ${REDACTED}`)
    expect(redactString('secret whsec_abcdef123456')).toBe(`secret ${REDACTED}`)
  })

  it('removes JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    expect(redactString(`token=${jwt}`)).toBe(`token=${REDACTED}`)
  })

  it('leaves harmless text untouched', () => {
    expect(redactString('connection request insert failed')).toBe(
      'connection request insert failed'
    )
  })
})

describe('redact', () => {
  it('drops values of sensitive keys regardless of their content', () => {
    expect(redact({ email: 'a@b.co', token: 'xyz', message: 'hi there' })).toEqual({
      email: REDACTED,
      token: REDACTED,
      message: REDACTED,
    })
  })

  it('matches sensitive keys as substrings and case-insensitively', () => {
    expect(redact({ userEmail: 'a@b.co', SERVICE_ROLE_KEY: 'k', body_text: 'x' })).toEqual({
      userEmail: REDACTED,
      SERVICE_ROLE_KEY: REDACTED,
      body_text: REDACTED,
    })
  })

  it('keeps non-sensitive scalars', () => {
    expect(redact({ route: '/api/cron/maintenance', status: 500, ok: false })).toEqual({
      route: '/api/cron/maintenance',
      status: 500,
      ok: false,
    })
  })

  it('recurses into nested objects and arrays', () => {
    expect(redact({ user: { id: 'u1', email: 'a@b.co' }, ids: ['x', 'y'] })).toEqual({
      user: { id: 'u1', email: REDACTED },
      ids: ['x', 'y'],
    })
  })

  it('redacts identifiers embedded in nested string values', () => {
    expect(redact({ detail: 'user a@b.co not found' })).toEqual({
      detail: `user ${REDACTED} not found`,
    })
  })

  it('truncates beyond the depth limit rather than recursing forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } }
    expect(JSON.stringify(redact(deep))).toContain('[truncated]')
  })

  it('drops functions and symbols', () => {
    expect(redact({ fn: () => undefined, keep: 1 })).toEqual({ fn: undefined, keep: 1 })
  })

  it('serialises dates and bigints', () => {
    expect(redact({ at: new Date('2026-01-01T00:00:00.000Z'), n: BigInt(10) })).toEqual({
      at: '2026-01-01T00:00:00.000Z',
      n: '10',
    })
  })
})

describe('redactContext', () => {
  it('returns an empty object for undefined', () => {
    expect(redactContext(undefined)).toEqual({})
  })

  it('redacts a supplied context', () => {
    expect(redactContext({ email: 'a@b.co', route: '/x' })).toEqual({
      email: REDACTED,
      route: '/x',
    })
  })
})
