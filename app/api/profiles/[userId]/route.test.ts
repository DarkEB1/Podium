import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return { ...actual, getPublicProfile: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/supabase/profiles'
import { GET } from './route'

const VALID_ROLES = ['athlete', 'team', 'brand', 'agent'] as const

function makeRequest(userId: string, role?: string) {
  const url = new URL(`/api/profiles/${userId}`, 'http://localhost')
  if (role) url.searchParams.set('role', role)
  return new NextRequest(url)
}

describe('GET /api/profiles/[userId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 400 when role query param is missing', async () => {
    const res = await GET(makeRequest('user-1'), { params: Promise.resolve({ userId: 'user-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('MISSING_ROLE')
  })

  it('returns 400 when role query param is invalid', async () => {
    const res = await GET(makeRequest('user-1', 'superuser'), {
      params: Promise.resolve({ userId: 'user-1' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_ROLE')
  })

  it('returns 404 when profile not found or not active', async () => {
    vi.mocked(getPublicProfile).mockResolvedValue(null)
    const res = await GET(makeRequest('user-1', 'athlete'), {
      params: Promise.resolve({ userId: 'user-1' }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROFILE_NOT_FOUND')
  })

  it('returns 200 with profile data on success', async () => {
    const fakeProfile = { id: 'p1', user_id: 'user-1', status: 'active' }
    vi.mocked(getPublicProfile).mockResolvedValue(fakeProfile as never)
    const res = await GET(makeRequest('user-1', 'athlete'), {
      params: Promise.resolve({ userId: 'user-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeProfile)
  })

  it.each(VALID_ROLES)('accepts %s as a valid role', async (role) => {
    vi.mocked(getPublicProfile).mockResolvedValue({ id: 'p1', user_id: 'u1', status: 'active' } as never)
    const res = await GET(makeRequest('u1', role), {
      params: Promise.resolve({ userId: 'u1' }),
    })
    expect(res.status).toBe(200)
  })
})
