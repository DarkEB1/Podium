import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const verifyTwoFactorLogin = vi.fn()
const consume = vi.fn()
const attach = vi.fn(async (res: unknown) => res)

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/supabase/two-factor', () => ({
  verifyTwoFactorLogin: (...a: unknown[]) => verifyTwoFactorLogin(...a),
}))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { admin2faByUser: { limit: 10, windowSeconds: 300 } },
  consume: (...a: unknown[]) => consume(...a),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:${b}`,
}))
vi.mock('@/lib/auth/admin-2fa-response', () => ({
  attachAdmin2faCookie: (res: unknown) => attach(res),
}))

import { POST } from './route'

function req(body: unknown = { token: '123456' }) {
  return new NextRequest('https://podium.test/api/admin/2fa/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  getUser.mockReset()
  verifyTwoFactorLogin.mockReset()
  consume.mockReset().mockResolvedValue({ allowed: true })
  attach.mockClear()
})

describe('POST /api/admin/2fa/verify', () => {
  it('401 when not signed in', async () => {
    getUser.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
  })

  it('403 for a non-admin', async () => {
    getUser.mockResolvedValue({ id: 'u1', role: 'brand', email: 'b@x.com' })
    expect((await POST(req())).status).toBe(403)
  })

  it('429 when rate limited', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    consume.mockResolvedValue({ allowed: false, retryAfter: 60 })
    expect((await POST(req())).status).toBe(429)
    expect(verifyTwoFactorLogin).not.toHaveBeenCalled()
  })

  it('401 on an invalid code and does not set the cookie', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    verifyTwoFactorLogin.mockResolvedValue(false)
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(attach).not.toHaveBeenCalled()
  })

  it('sets the 2FA cookie on a valid code', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    verifyTwoFactorLogin.mockResolvedValue(true)
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(attach).toHaveBeenCalledTimes(1)
  })
})
