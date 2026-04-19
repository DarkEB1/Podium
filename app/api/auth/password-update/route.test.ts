import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/password-update', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/password-update', () => {
  const mockGetUser = vi.fn()
  const mockUpdateUser = vi.fn()

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: mockGetUser, updateUser: mockUpdateUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_FIELDS')
  })

  it('returns 400 when password is too weak', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    const res = await POST(makeRequest({ password: 'weak' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('WEAK_PASSWORD')
  })

  it('returns 401 when there is no active recovery session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ password: 'ValidPass1!' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 200 on successful password update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ password: 'NewValidPass1!' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
