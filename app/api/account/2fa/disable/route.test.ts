import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const verifyTwoFactorLogin = vi.fn()
const disableTwoFactor = vi.fn()
const consume = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/supabase/two-factor', () => ({
  verifyTwoFactorLogin: (...a: unknown[]) => verifyTwoFactorLogin(...a),
  disableTwoFactor: (...a: unknown[]) => disableTwoFactor(...a),
}))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { admin2faByUser: { limit: 10, windowSeconds: 300 } },
  consume: (...a: unknown[]) => consume(...a),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:user:${b}`,
}))

import { POST } from './route'

function req(body: unknown = { token: '123456' }) {
  return new NextRequest('https://podium.test/api/account/2fa/disable', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const signedIn = { id: 'u1', role: 'athlete', email: 'a@x.com' }

beforeEach(() => {
  getUser.mockReset().mockResolvedValue(signedIn)
  verifyTwoFactorLogin.mockReset()
  disableTwoFactor.mockReset().mockResolvedValue(undefined)
  consume.mockReset().mockResolvedValue({ allowed: true })
})

describe('POST /api/account/2fa/disable', () => {
  it('401 when not signed in', async () => {
    getUser.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
    expect(disableTwoFactor).not.toHaveBeenCalled()
  })

  // ── SECURITY ────────────────────────────────────────────────────────────
  // A live session alone used to be enough: one POST wiped the secret. That is
  // precisely the move a stolen session makes, so 2FA protected nothing against
  // the case it exists for. /activate has always demanded a code; the asymmetry
  // was the bug.
  it('refuses to disable on a session alone, with no code supplied', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_TOKEN')
    expect(disableTwoFactor).not.toHaveBeenCalled()
  })

  it('401 on an invalid code and leaves 2FA enabled', async () => {
    verifyTwoFactorLogin.mockResolvedValue(false)
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('INVALID_CODE')
    expect(disableTwoFactor).not.toHaveBeenCalled()
  })

  it('400 when the body is not JSON', async () => {
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
    expect(disableTwoFactor).not.toHaveBeenCalled()
  })

  it('429 when rate limited, before any verification', async () => {
    consume.mockResolvedValue({ allowed: false, retryAfter: 60 })
    expect((await POST(req())).status).toBe(429)
    expect(verifyTwoFactorLogin).not.toHaveBeenCalled()
    expect(disableTwoFactor).not.toHaveBeenCalled()
  })

  it('limits guesses in its own key namespace', async () => {
    verifyTwoFactorLogin.mockResolvedValue(true)
    await POST(req())
    expect(consume).toHaveBeenCalledWith('account_2fa_disable:user:u1', expect.anything())
  })

  // verifyTwoFactorLogin accepts a one-time recovery code as well as a live
  // TOTP, which is how the rest of the app treats recovery codes.
  it('disables and wipes the secret on a valid code', async () => {
    verifyTwoFactorLogin.mockResolvedValue(true)
    const res = await POST(req({ token: 'A1B2C-3D4E5' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(verifyTwoFactorLogin).toHaveBeenCalledWith(expect.anything(), 'u1', 'A1B2C-3D4E5')
    expect(disableTwoFactor).toHaveBeenCalledWith(expect.anything(), 'u1')
  })
})
