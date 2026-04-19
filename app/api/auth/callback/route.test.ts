import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

function makeRequest(params: Record<string, string>) {
  const url = new URL('/api/auth/callback', 'http://localhost')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/auth/callback', () => {
  const mockExchange = vi.fn()
  const mockUpdate = vi.fn()
  const mockEq = vi.fn()

  beforeEach(() => {
    mockEq.mockReturnValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchange },
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as ReturnType<Awaited<typeof createClient>>)
    mockExchange.mockResolvedValue({
      error: null,
      data: { session: { user: { id: 'user-123' } } },
    })
  })

  it('redirects to /login?error=... when no code is provided', async () => {
    const res = await GET(makeRequest({ type: 'email_confirmation' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/login.*error/)
  })

  it('redirects to /role-select after successful email confirmation', async () => {
    const res = await GET(makeRequest({ code: 'abc123', type: 'email_confirmation' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/role-select/)
  })

  it('redirects to /update-password after successful password recovery', async () => {
    const res = await GET(makeRequest({ code: 'abc123', type: 'recovery' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/update-password/)
  })

  it('redirects to /login?error=... when code exchange fails', async () => {
    mockExchange.mockResolvedValue({ error: { message: 'invalid code' }, data: { session: null } })
    const res = await GET(makeRequest({ code: 'bad', type: 'email_confirmation' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/login.*error/)
  })
})
