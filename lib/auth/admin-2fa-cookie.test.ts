import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  signAdmin2faCookie,
  verifyAdmin2faCookie,
  ADMIN_2FA_TTL_MS,
} from './admin-2fa-cookie'

describe('admin 2FA cookie', () => {
  beforeEach(() => {
    process.env.ADMIN_2FA_COOKIE_SECRET = 'a-sufficiently-long-secret-value'
  })
  afterEach(() => {
    delete process.env.ADMIN_2FA_COOKIE_SECRET
  })

  it('verifies a freshly signed cookie for the same user', async () => {
    const now = 1_700_000_000_000
    const token = await signAdmin2faCookie('admin-1', now)
    expect(await verifyAdmin2faCookie(token, 'admin-1', now + 1000)).toBe(true)
  })

  it('rejects the cookie for a different user', async () => {
    const token = await signAdmin2faCookie('admin-1')
    expect(await verifyAdmin2faCookie(token, 'admin-2')).toBe(false)
  })

  it('rejects an expired cookie', async () => {
    const now = 1_700_000_000_000
    const token = await signAdmin2faCookie('admin-1', now)
    expect(await verifyAdmin2faCookie(token, 'admin-1', now + ADMIN_2FA_TTL_MS + 1)).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const now = 1_700_000_000_000
    const token = await signAdmin2faCookie('admin-1', now)
    const [uid, exp] = token.split('.')
    expect(await verifyAdmin2faCookie(`${uid}.${exp}.deadbeef`, 'admin-1', now + 1)).toBe(false)
  })

  it('rejects a forged expiry (signature no longer matches)', async () => {
    const now = 1_700_000_000_000
    const token = await signAdmin2faCookie('admin-1', now)
    const [uid, , sig] = token.split('.')
    const farFuture = now + 10 * ADMIN_2FA_TTL_MS
    expect(await verifyAdmin2faCookie(`${uid}.${farFuture}.${sig}`, 'admin-1', now + 1)).toBe(false)
  })

  it('returns false when the secret is unset', async () => {
    delete process.env.ADMIN_2FA_COOKIE_SECRET
    expect(await verifyAdmin2faCookie('a.b.c', 'admin-1')).toBe(false)
  })

  it('throws when signing without a secret', async () => {
    delete process.env.ADMIN_2FA_COOKIE_SECRET
    await expect(signAdmin2faCookie('admin-1')).rejects.toThrow(/ADMIN_2FA_COOKIE_SECRET/)
  })
})
