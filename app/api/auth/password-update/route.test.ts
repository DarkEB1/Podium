import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
const consume = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { reauthByUser: { limit: 8, windowSeconds: 300 } },
  consume: (...a: unknown[]) => consume(...a),
  tooManyRequests: () => new Response(null, { status: 429 }),
  userKey: (a: string, b: string) => `${a}:user:${b}`,
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

const mockGetUser = vi.fn()
const mockUpdateUser = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()

function makeRequest(body: Record<string, unknown> | string, opts: { recovery?: boolean } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.recovery) headers['cookie'] = 'podium-recovery=1'
  return new NextRequest(new URL('/api/auth/password-update', 'http://localhost'), {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/auth/password-update', () => {
  beforeEach(() => {
    consume.mockReset().mockResolvedValue({ allowed: true })
    mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-123', email: 'a@x.com' } }, error: null })
    mockUpdateUser.mockReset().mockResolvedValue({ error: null })
    mockSignIn.mockReset().mockResolvedValue({ error: null })
    mockSignOut.mockReset().mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
        updateUser: mockUpdateUser,
        signInWithPassword: mockSignIn,
        signOut: mockSignOut,
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 400 when the body is not JSON', async () => {
    const res = await POST(makeRequest('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when password is too weak', async () => {
    const res = await POST(makeRequest({ password: 'weak', current_password: 'x' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('WEAK_PASSWORD')
  })

  it('returns 401 when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ password: 'ValidPass1!', current_password: 'x' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })

  // ── Logged-in change (WS-ACCT-03): current password re-verified ──────────
  it('rejects a logged-in change with no current password', async () => {
    const res = await POST(makeRequest({ password: 'NewValidPass1!' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_CURRENT_PASSWORD')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('rejects a wrong current password with 401 and does not update', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await POST(makeRequest({ password: 'NewValidPass1!', current_password: 'WRONG' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('updates and signs out OTHER sessions on a valid logged-in change', async () => {
    const res = await POST(makeRequest({ password: 'NewValidPass1!', current_password: 'Old-pass1!' }))
    expect(res.status).toBe(200)
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@x.com', password: 'Old-pass1!' })
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewValidPass1!' })
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  // ── Recovery flow (WS-ACCT-04): no current password, global sign-out ─────
  it('accepts a recovery-cookie change without a current password and signs out globally', async () => {
    const res = await POST(makeRequest({ password: 'NewValidPass1!' }, { recovery: true }))
    expect(res.status).toBe(200)
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewValidPass1!' })
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' })
    // recovery marker cleared
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('podium-recovery=')
  })
})
