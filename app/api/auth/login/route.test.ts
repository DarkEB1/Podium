import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/login', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  const mockSignIn = vi.fn()

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { signInWithPassword: mockSignIn },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 400 when email or password is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 INVALID_JSON on a malformed body', async () => {
    const req = new NextRequest(new URL('/api/auth/login', 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_JSON')
  })

  it('returns 401 on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 for oversized credentials without calling the provider', async () => {
    mockSignIn.mockClear()
    const res = await POST(
      makeRequest({ email: `${'a'.repeat(255)}@example.com`, password: 'ValidPass1!' })
    )
    expect(res.status).toBe(401)
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  // With Supabase email confirmations enabled, an unverified account must not
  // be reported as a wrong password.
  it('returns 403 EMAIL_NOT_CONFIRMED when the account is unverified', async () => {
    mockSignIn.mockResolvedValue({
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'ValidPass1!' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('EMAIL_NOT_CONFIRMED')
  })

  it('returns 200 with user data on valid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    const fakeUser = { id: 'user-123', email: 'test@example.com', role: null }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)

    const res = await POST(makeRequest({ email: 'test@example.com', password: 'ValidPass1!' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user).toEqual(fakeUser)
  })
})
