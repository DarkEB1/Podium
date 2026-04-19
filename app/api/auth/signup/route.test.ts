import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/signup', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  const mockSignUp = vi.fn()

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    mockSignUp.mockResolvedValue({ error: null })
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'ValidPass1!' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when password is too weak', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'weak' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('WEAK_PASSWORD')
  })

  it('returns 200 with success message on valid signup (enumeration protection)', async () => {
    const res = await POST(makeRequest({ email: 'new@example.com', password: 'ValidPass1!' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toMatch(/email/i)
  })

  it('still returns 200 when Supabase reports email already registered (enumeration protection)', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } })
    const res = await POST(makeRequest({ email: 'existing@example.com', password: 'ValidPass1!' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toMatch(/email/i)
  })
})
