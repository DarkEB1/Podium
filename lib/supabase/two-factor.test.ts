import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  beginEnrollment,
  activateTwoFactor,
  verifyTwoFactorLogin,
  getTwoFactorStatus,
  disableTwoFactor,
  TwoFactorError,
} from './two-factor'
import { generateTotpSecret, generateTotp } from '@/lib/auth/totp'
import { encryptSecret } from '@/lib/auth/secret-crypto'
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeAdmin() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const mutationQueue: Array<{ error: unknown }> = []
  const upserts: Array<Record<string, unknown>> = []
  const updates: Array<Record<string, unknown>> = []
  let pending: { error: unknown } | undefined

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null })),
    upsert: vi.fn((payload: Record<string, unknown>) => {
      upserts.push(payload)
      return Promise.resolve(mutationQueue.shift() ?? { error: null })
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload)
      pending = mutationQueue.shift() ?? { error: null }
      return builder
    }),
    delete: vi.fn(() => {
      pending = mutationQueue.shift() ?? { error: null }
      return builder
    }),
    then(onF: (v: { error: unknown }) => unknown) {
      const r = pending ?? { error: null }
      pending = undefined
      return Promise.resolve(r).then(onF)
    },
  }

  return {
    admin: { from: vi.fn(() => builder) } as unknown as SupabaseClient<Database>,
    upserts,
    updates,
    queueRow: (data: unknown) => singleQueue.push({ data, error: null }),
    queueMutation: (error: unknown = null) => mutationQueue.push({ error }),
  }
}

const KEY = 'b'.repeat(64)

beforeEach(() => {
  process.env.TWO_FACTOR_ENCRYPTION_KEY = KEY
})
afterEach(() => {
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY
})

describe('beginEnrollment', () => {
  it('stores an encrypted (not plaintext) secret and returns the otpauth url', async () => {
    const m = makeAdmin()
    m.queueMutation()
    const { secret, otpauthUrl } = await beginEnrollment(m.admin, 'admin-1', 'admin@podium.app')

    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(otpauthUrl).toContain('otpauth://totp/')
    const stored = m.upserts[0]!.secret as string
    expect(stored).not.toBe(secret)
    expect(m.upserts[0]!.enabled).toBe(false)
  })
})

describe('activateTwoFactor', () => {
  it('enables 2FA and returns ten recovery codes for a valid code', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: false, recovery_codes: [], confirmed_at: null })
    m.queueMutation()

    const { recoveryCodes } = await activateTwoFactor(m.admin, 'admin-1', generateTotp(secret))

    expect(recoveryCodes).toHaveLength(10)
    expect(m.updates[0]!.enabled).toBe(true)
    // recovery codes are stored hashed, never in plaintext
    const stored = m.updates[0]!.recovery_codes as string[]
    expect(stored).not.toContain(recoveryCodes[0])
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects an invalid code', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: false, recovery_codes: [], confirmed_at: null })
    await expect(activateTwoFactor(m.admin, 'admin-1', '000000')).rejects.toMatchObject({
      code: 'INVALID_CODE',
    })
  })

  it('throws NOT_ENROLLED when there is no pending secret', async () => {
    const m = makeAdmin()
    m.queueRow(null)
    await expect(activateTwoFactor(m.admin, 'admin-1', '123456')).rejects.toBeInstanceOf(TwoFactorError)
  })
})

describe('verifyTwoFactorLogin', () => {
  it('accepts a valid TOTP code', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: true, recovery_codes: [], confirmed_at: '2026-01-01' })
    expect(await verifyTwoFactorLogin(m.admin, 'admin-1', generateTotp(secret))).toBe(true)
  })

  it('accepts and consumes a recovery code', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    const recovery = 'ABCDE-FGHJK'
    const hash = createHash('sha256').update('ABCDEFGHJK').digest('hex')
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: true, recovery_codes: [hash], confirmed_at: '2026-01-01' })
    m.queueMutation()

    expect(await verifyTwoFactorLogin(m.admin, 'admin-1', recovery)).toBe(true)
    // the used code is removed
    expect(m.updates[0]!.recovery_codes).toEqual([])
  })

  it('returns false when 2FA is not enabled', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: false, recovery_codes: [], confirmed_at: null })
    expect(await verifyTwoFactorLogin(m.admin, 'admin-1', generateTotp(secret))).toBe(false)
  })

  it('returns false for a wrong code', async () => {
    const m = makeAdmin()
    const secret = generateTotpSecret()
    m.queueRow({ user_id: 'admin-1', secret: encryptSecret(secret), enabled: true, recovery_codes: [], confirmed_at: '2026-01-01' })
    expect(await verifyTwoFactorLogin(m.admin, 'admin-1', '000000')).toBe(false)
  })
})

describe('disableTwoFactor', () => {
  it('deletes the row without error', async () => {
    const m = makeAdmin()
    m.queueMutation()
    await expect(disableTwoFactor(m.admin, 'admin-1')).resolves.toBeUndefined()
  })

  it('throws DISABLE_FAILED on a DB error', async () => {
    const m = makeAdmin()
    m.queueMutation({ message: 'db down' })
    await expect(disableTwoFactor(m.admin, 'admin-1')).rejects.toMatchObject({ code: 'DISABLE_FAILED' })
  })
})

describe('getTwoFactorStatus', () => {
  it('reports enrolled and enabled state', async () => {
    const m = makeAdmin()
    m.queueRow({ user_id: 'admin-1', secret: 'x', enabled: true, recovery_codes: [], confirmed_at: '2026-01-01' })
    expect(await getTwoFactorStatus(m.admin, 'admin-1')).toEqual({
      enrolled: true,
      enabled: true,
      confirmedAt: '2026-01-01',
    })
  })

  it('reports not-enrolled when there is no row', async () => {
    const m = makeAdmin()
    m.queueRow(null)
    expect(await getTwoFactorStatus(m.admin, 'admin-1')).toEqual({
      enrolled: false,
      enabled: false,
      confirmedAt: null,
    })
  })
})
