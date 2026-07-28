import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const activateTwoFactor = vi.fn()
const attach = vi.fn(async (res: unknown) => res)

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/supabase/two-factor', () => ({
  activateTwoFactor: (...a: unknown[]) => activateTwoFactor(...a),
  // Defined inline: a top-level class cannot be referenced from a hoisted factory.
  TwoFactorError: class TwoFactorError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock('@/lib/auth/admin-2fa-response', () => ({
  attachAdmin2faCookie: (res: unknown) => attach(res),
}))

import { POST } from './route'
import { TwoFactorError } from '@/lib/supabase/two-factor'

function req(body: unknown = { token: '123456' }) {
  return new NextRequest('https://podium.test/api/admin/2fa/activate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  getUser.mockReset()
  activateTwoFactor.mockReset()
  attach.mockClear()
})

describe('POST /api/admin/2fa/activate', () => {
  it('403 for a non-admin', async () => {
    getUser.mockResolvedValue({ id: 'u1', role: 'athlete', email: 'x@x.com' })
    expect((await POST(req())).status).toBe(403)
  })

  it('returns recovery codes and sets the cookie on success', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    activateTwoFactor.mockResolvedValue({ recoveryCodes: ['AAAAA-BBBBB'] })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect((await res.json()).recoveryCodes).toEqual(['AAAAA-BBBBB'])
    expect(attach).toHaveBeenCalledTimes(1)
  })

  it('maps an invalid code to 400', async () => {
    getUser.mockResolvedValue({ id: 'a1', role: 'admin', email: 'a@x.com' })
    activateTwoFactor.mockRejectedValue(new TwoFactorError('INVALID_CODE', 'nope'))
    expect((await POST(req())).status).toBe(400)
  })
})
