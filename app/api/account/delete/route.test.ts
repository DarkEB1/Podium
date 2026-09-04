import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const requestDeletion = vi.fn()
const consume = vi.fn()
const signInWithPassword = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  })),
}))
vi.mock('@/lib/supabase/auth', () => ({
  getUser: (...a: unknown[]) => getUser(...a),
  requestDeletion: (...a: unknown[]) => requestDeletion(...a),
}))
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { reauthByUser: { limit: 8, windowSeconds: 300 } },
  consume: (...a: unknown[]) => consume(...a),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:user:${b}`,
}))

import { POST } from './route'

function req(body: unknown = { password: 'Old-pass1!' }) {
  return new NextRequest('https://podium.test/api/account/delete', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const signedIn = { id: 'u1', role: 'athlete', email: 'a@x.com' }

beforeEach(() => {
  getUser.mockReset().mockResolvedValue(signedIn)
  requestDeletion.mockReset().mockResolvedValue(undefined)
  consume.mockReset().mockResolvedValue({ allowed: true })
  signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null })
  signOut.mockReset().mockResolvedValue({ error: null })
})

describe('POST /api/account/delete', () => {
  it('401 when not signed in', async () => {
    getUser.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
    expect(requestDeletion).not.toHaveBeenCalled()
  })

  it('400 when the body is not JSON', async () => {
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
    expect(requestDeletion).not.toHaveBeenCalled()
  })

  it('400 when no password is supplied (re-auth is mandatory)', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_PASSWORD')
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(requestDeletion).not.toHaveBeenCalled()
  })

  it('401 on a wrong current password, and does NOT schedule deletion', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    const res = await POST(req({ password: 'wrong' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS')
    expect(requestDeletion).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('429 when rate limited, before verifying the password', async () => {
    consume.mockResolvedValue({ allowed: false, retryAfter: 60 })
    expect((await POST(req())).status).toBe(429)
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(requestDeletion).not.toHaveBeenCalled()
  })

  it('re-authenticates, schedules deletion, then signs the user out', async () => {
    const res = await POST(req({ password: 'Old-pass1!' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@x.com', password: 'Old-pass1!' })
    expect(requestDeletion).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(signOut).toHaveBeenCalled()
    // re-auth must precede the destructive write
    const reauthOrder = signInWithPassword.mock.invocationCallOrder[0]!
    const deleteOrder = requestDeletion.mock.invocationCallOrder[0]!
    expect(reauthOrder).toBeLessThan(deleteOrder)
  })

  it('accepts current_password as an alias for the password field', async () => {
    const res = await POST(req({ current_password: 'Old-pass1!' }))
    expect(res.status).toBe(200)
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@x.com', password: 'Old-pass1!' })
  })
})
