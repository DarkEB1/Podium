import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe'

describe('unsubscribe tokens (CL-4)', () => {
  const original = process.env.UNSUBSCRIBE_SECRET

  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-at-least-16-chars-long'
  })
  afterEach(() => {
    if (original === undefined) delete process.env.UNSUBSCRIBE_SECRET
    else process.env.UNSUBSCRIBE_SECRET = original
  })

  it('round-trips a valid token to its claim', () => {
    const token = signUnsubscribeToken('user-1', 'marketing')
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'user-1', purpose: 'marketing' })
  })

  it('defaults the purpose to "all"', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken('user-1'))).toEqual({
      userId: 'user-1',
      purpose: 'all',
    })
  })

  it('rejects a token whose userId was tampered with', () => {
    const token = signUnsubscribeToken('user-1', 'all')
    const forged = token.replace('user-1', 'user-2')
    expect(verifyUnsubscribeToken(forged)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signUnsubscribeToken('user-1', 'all')
    process.env.UNSUBSCRIBE_SECRET = 'a-completely-different-secret-value'
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })

  it('rejects malformed tokens and unknown purposes', () => {
    expect(verifyUnsubscribeToken('')).toBeNull()
    expect(verifyUnsubscribeToken('only.two')).toBeNull()
    expect(verifyUnsubscribeToken('user.bogus.sig')).toBeNull()
  })

  it('fails closed when the secret is unset: cannot sign, cannot verify', () => {
    const token = signUnsubscribeToken('user-1', 'all')
    delete process.env.UNSUBSCRIBE_SECRET
    expect(() => signUnsubscribeToken('user-1')).toThrow()
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })
})
