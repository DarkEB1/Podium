import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn(), lockRole: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser, lockRole, AuthError } from '@/lib/supabase/auth'
import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('/api/auth/role', 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/role', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue({} as ReturnType<Awaited<typeof createClient>>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ role: 'athlete' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when role is invalid', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123' } as never)
    const res = await POST(makeRequest({ role: 'superuser' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ROLE')
  })

  it('returns 400 with ROLE_ALREADY_LOCKED when role has been set', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123' } as never)
    vi.mocked(lockRole).mockRejectedValue(
      new AuthError('ROLE_ALREADY_LOCKED', 'Role has already been set')
    )
    const res = await POST(makeRequest({ role: 'athlete' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('ROLE_ALREADY_LOCKED')
  })

  it('returns 200 with the locked role on success', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123' } as never)
    vi.mocked(lockRole).mockResolvedValue(undefined)
    const res = await POST(makeRequest({ role: 'brand' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.role).toBe('brand')
  })

  it('rejects admin as a selectable role (admin accounts are created out-of-band)', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123' } as never)
    const res = await POST(makeRequest({ role: 'admin' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ROLE')
  })
})
