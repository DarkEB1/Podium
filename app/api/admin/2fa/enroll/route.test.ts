import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// WS-SEC-02 — /api/admin/2fa/* is exempt from the middleware 2FA-cookie gate so
// an admin can obtain the cookie in the first place. That left enroll reachable
// with a password alone. beginEnrollment() overwrites the secret, wipes recovery
// codes and returns the plaintext secret, so a password-only attacker could
// re-enroll, compute a TOTP, activate, pass the cookie — AND destroy the real
// admin's authenticator. Enroll must refuse to re-enroll an already-enabled
// admin unless the request proves possession of the current second factor.

const getUser = vi.fn()
const getTwoFactorStatus = vi.fn()
const beginEnrollment = vi.fn()
const verifyTwoFactorLogin = vi.fn()
const verifyAdmin2faCookie = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/supabase/two-factor', () => ({
  getTwoFactorStatus: (...a: unknown[]) => getTwoFactorStatus(...a),
  beginEnrollment: (...a: unknown[]) => beginEnrollment(...a),
  verifyTwoFactorLogin: (...a: unknown[]) => verifyTwoFactorLogin(...a),
}))
vi.mock('@/lib/auth/admin-2fa-cookie', () => ({
  ADMIN_2FA_COOKIE: 'podium_admin_2fa',
  verifyAdmin2faCookie: (...a: unknown[]) => verifyAdmin2faCookie(...a),
}))

import { POST } from './route'

function req(opts: { body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.cookie) headers.cookie = opts.cookie
  return new NextRequest('https://podium.test/api/admin/2fa/enroll', {
    method: 'POST',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
}

beforeEach(() => {
  getUser.mockReset()
  getTwoFactorStatus.mockReset()
  beginEnrollment.mockReset()
  verifyTwoFactorLogin.mockReset()
  verifyAdmin2faCookie.mockReset()
  beginEnrollment.mockResolvedValue({ secret: 'SECRET', otpauthUrl: 'otpauth://x' })
  verifyAdmin2faCookie.mockResolvedValue(false)
  verifyTwoFactorLogin.mockResolvedValue(false)
})

describe('POST /api/admin/2fa/enroll', () => {
  it('401 when unauthenticated', async () => {
    getUser.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
  })

  it('403 for a non-admin', async () => {
    getUser.mockResolvedValue({ id: 'u1', role: 'athlete', email: 'x@x.com' })
    expect((await POST(req())).status).toBe(403)
  })

  it('enrolls a fresh admin who has not enabled 2FA yet', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    getTwoFactorStatus.mockResolvedValue({ enabled: false, enrolled: false, confirmedAt: null })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect((await res.json()).secret).toBe('SECRET')
    expect(beginEnrollment).toHaveBeenCalledTimes(1)
  })

  // The core hole: a password-only attacker cannot re-enroll and wipe the real
  // admin's authenticator.
  it('409 when 2FA is already enabled and no second factor accompanies the request', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    getTwoFactorStatus.mockResolvedValue({ enabled: true, enrolled: true, confirmedAt: 't' })
    const res = await POST(req())
    expect(res.status).toBe(409)
    expect(beginEnrollment).not.toHaveBeenCalled()
  })

  it('allows re-enrolment when a valid 2FA session cookie is present', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    getTwoFactorStatus.mockResolvedValue({ enabled: true, enrolled: true, confirmedAt: 't' })
    verifyAdmin2faCookie.mockResolvedValue(true)
    const res = await POST(req({ cookie: 'podium_admin_2fa=valid' }))
    expect(res.status).toBe(200)
    expect(beginEnrollment).toHaveBeenCalledTimes(1)
  })

  it('allows re-enrolment when a current TOTP code is supplied', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    getTwoFactorStatus.mockResolvedValue({ enabled: true, enrolled: true, confirmedAt: 't' })
    verifyTwoFactorLogin.mockResolvedValue(true)
    const res = await POST(req({ body: { token: '123456' } }))
    expect(res.status).toBe(200)
    expect(verifyTwoFactorLogin).toHaveBeenCalled()
    expect(beginEnrollment).toHaveBeenCalledTimes(1)
  })

  it('409 when the supplied code is wrong and there is no cookie', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    getTwoFactorStatus.mockResolvedValue({ enabled: true, enrolled: true, confirmedAt: 't' })
    verifyTwoFactorLogin.mockResolvedValue(false)
    const res = await POST(req({ body: { token: '000000' } }))
    expect(res.status).toBe(409)
    expect(beginEnrollment).not.toHaveBeenCalled()
  })
})
