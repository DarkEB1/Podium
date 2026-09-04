import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const consume = vi.fn()
const updateUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { updateUser: (...a: unknown[]) => updateUser(...a) },
  })),
}))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { reauthByUser: { limit: 8, windowSeconds: 300 } },
  consume: (...a: unknown[]) => consume(...a),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:user:${b}`,
}))

import { POST } from './route'

function req(body: unknown = { email: 'new@x.com' }) {
  return new NextRequest('https://podium.test/api/account/email', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const signedIn = { id: 'u1', role: 'athlete', email: 'old@x.com' }

beforeEach(() => {
  getUser.mockReset().mockResolvedValue(signedIn)
  consume.mockReset().mockResolvedValue({ allowed: true })
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('POST /api/account/email', () => {
  it('401 when not signed in', async () => {
    getUser.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('400 when the body is not JSON', async () => {
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })

  it('400 on a missing or malformed email', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect((await POST(req({ email: 'nope' }))).status).toBe(400)
    expect((await POST(req({ email: 'a'.repeat(255) + '@x.com' }))).status).toBe(400)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('400 when the new email equals the current one', async () => {
    const res = await POST(req({ email: 'OLD@x.com' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('SAME_EMAIL')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('issues a secure email change (confirmation to both addresses) and reports success', async () => {
    const res = await POST(req({ email: 'New@x.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    // normalised + emailRedirectTo pointing back at our callback
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'new@x.com' },
      expect.objectContaining({ emailRedirectTo: expect.stringContaining('/api/auth/callback') })
    )
  })

  it('surfaces a provider error as a readable 400', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { message: 'email rate limit exceeded' } })
    const res = await POST(req({ email: 'new@x.com' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('EMAIL_UPDATE_FAILED')
  })
})
