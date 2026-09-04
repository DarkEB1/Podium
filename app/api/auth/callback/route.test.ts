import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { GET } from './route'
import { authErrorMessage } from '@/components/auth/auth-errors'

function makeRequest(params: Record<string, string>) {
  const url = new URL('/api/auth/callback', 'http://localhost')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

function location(res: Response): URL {
  return new URL(res.headers.get('location') ?? '', 'http://localhost')
}

describe('GET /api/auth/callback', () => {
  const mockExchange = vi.fn()
  const mockUpdate = vi.fn()
  const mockEq = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockReturnValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchange },
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    mockExchange.mockResolvedValue({
      error: null,
      data: { session: { user: { id: 'user-123' } } },
    })
  })

  it('redirects to /role-select after successful email confirmation', async () => {
    const res = await GET(makeRequest({ code: 'abc123', type: 'email_confirmation' }))
    expect(res.status).toBe(307)
    expect(location(res).pathname).toBe('/role-select')
  })

  it('redirects to /update-password after successful password recovery', async () => {
    const res = await GET(makeRequest({ code: 'abc123', type: 'recovery' }))
    expect(res.status).toBe(307)
    expect(location(res).pathname).toBe('/update-password')
  })

  // WS-ACCT-04: the recovery redirect must carry the confinement marker so the
  // reset-link session cannot roam the app before setting a new password.
  it('sets the recovery marker cookie on the recovery redirect only', async () => {
    const recovery = await GET(makeRequest({ code: 'abc123', type: 'recovery' }))
    expect(recovery.headers.get('set-cookie') ?? '').toContain('podium-recovery=1')

    const confirm = await GET(makeRequest({ code: 'abc123', type: 'email_confirmation' }))
    expect(confirm.headers.get('set-cookie') ?? '').not.toContain('podium-recovery=1')
  })

  // B-3 / NX-1: failures used to redirect to /login, which does not exist.
  it('sends failures to the real sign-in route, never /login', async () => {
    const res = await GET(makeRequest({ type: 'email_confirmation' }))
    const url = location(res)
    expect(url.pathname).toBe('/auth')
    expect(url.pathname).not.toBe('/login')
  })

  it('carries a missing-code error the sign-in page can render', async () => {
    const res = await GET(makeRequest({ type: 'email_confirmation' }))
    const code = location(res).searchParams.get('error')
    expect(code).toBe('auth_missing_code')
    expect(authErrorMessage(code)).toMatch(/incomplete/i)
  })

  it('classifies a failed code exchange', async () => {
    mockExchange.mockResolvedValue({ error: { message: 'invalid code' }, data: { session: null } })
    const res = await GET(makeRequest({ code: 'bad', type: 'email_confirmation' }))
    const url = location(res)
    expect(url.pathname).toBe('/auth')
    expect(url.searchParams.get('error')).toBe('auth_link_invalid')
  })

  it('handles the error params Supabase itself appends to a failed confirmation', async () => {
    const res = await GET(
      makeRequest({
        error: 'access_denied',
        error_code: 'otp_expired',
        error_description: 'Email link is invalid or has expired',
      }),
    )
    const url = location(res)
    expect(url.pathname).toBe('/auth')
    expect(url.searchParams.get('error')).toBe('auth_link_expired')
    expect(mockExchange).not.toHaveBeenCalled()
  })

  it('never leaks a raw provider message into the redirect', async () => {
    const res = await GET(
      makeRequest({ error: 'server_error', error_description: 'PGRST-boom internal detail' }),
    )
    expect(res.headers.get('location')).not.toContain('PGRST')
  })
})
