import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/password-reset', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/password-reset', () => {
  const mockReset = vi.fn()

  beforeEach(() => {
    mockReset.mockClear()
    vi.mocked(createClient).mockResolvedValue({
      auth: { resetPasswordForEmail: mockReset },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    mockReset.mockResolvedValue({ error: null })
  })

  it('always returns 200 with the same message regardless of email existence (enumeration protection)', async () => {
    const res = await POST(makeRequest({ email: 'anyone@example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toMatch(/if this email exists/i)
  })

  it('still returns 200 when no email is provided — does not call Supabase', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    expect(mockReset).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_JSON on a malformed body', async () => {
    const req = new NextRequest(new URL('/api/auth/password-reset', 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })

  // P2 cluster: a 2 MB "email" must never be forwarded to the provider.
  it('does not forward an over-length email to Supabase, but still answers generically', async () => {
    const res = await POST(makeRequest({ email: 'a'.repeat(2_000_000) + '@x.com' }))
    expect(res.status).toBe(200)
    expect(mockReset).not.toHaveBeenCalled()
  })

  it('ignores a non-string email without calling Supabase', async () => {
    const res = await POST(makeRequest({ email: 12345 as unknown as string }))
    expect(res.status).toBe(200)
    expect(mockReset).not.toHaveBeenCalled()
  })
})
