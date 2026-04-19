import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return { ...actual, createProfile: vi.fn(), getOwnProfile: vi.fn(), updateProfile: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { createProfile, getOwnProfile, updateProfile, ProfileError } from '@/lib/supabase/profiles'
import { GET, POST, PATCH } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'athlete' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/profiles/me', 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/profiles/me', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when role is not set', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: null } as never)
    const res = await GET()
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('ROLE_NOT_SET')
  })

  it('returns 404 when profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROFILE_NOT_FOUND')
  })

  it('returns 200 with profile on success', async () => {
    const fakeProfile = { id: 'p1', user_id: 'user-1', status: 'draft', display_name: 'Alice' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeProfile as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeProfile)
  })
})

describe('POST /api/profiles/me', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when role is not locked', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role_locked_at: null } as never)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('ROLE_NOT_LOCKED')
  })

  it('returns 409 when profile already exists', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createProfile).mockRejectedValue(
      new ProfileError('PROFILE_ALREADY_EXISTS', 'Already exists')
    )
    const res = await POST(makeRequest('POST', { display_name: 'Alice' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('PROFILE_ALREADY_EXISTS')
  })

  it('returns 201 with created profile on success', async () => {
    const fakeProfile = { id: 'p1', user_id: 'user-1', status: 'draft' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(createProfile).mockResolvedValue(fakeProfile as never)
    const res = await POST(makeRequest('POST', { display_name: 'Alice' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeProfile)
  })
})

describe('PATCH /api/profiles/me', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', {}))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 when role is not set', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: null } as never)
    const res = await PATCH(makeRequest('PATCH', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('ROLE_NOT_SET')
  })

  it('returns 404 when profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(updateProfile).mockRejectedValue(
      new ProfileError('PROFILE_NOT_FOUND', 'Not found')
    )
    const res = await PATCH(makeRequest('PATCH', { display_name: 'New' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('PROFILE_NOT_FOUND')
  })

  it('returns 200 with updated profile on success', async () => {
    const fakeProfile = { id: 'p1', user_id: 'user-1', display_name: 'Updated' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(updateProfile).mockResolvedValue(fakeProfile as never)
    const res = await PATCH(makeRequest('PATCH', { display_name: 'Updated' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeProfile)
  })
})
