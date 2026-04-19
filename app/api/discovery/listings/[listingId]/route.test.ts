import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/profiles')>()
  return { ...actual, getOwnProfile: vi.fn() }
})
vi.mock('@/lib/supabase/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/discovery')>()
  return { ...actual, getListing: vi.fn(), updateListing: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing, updateListing, DiscoveryError } from '@/lib/supabase/discovery'
import { GET, PATCH } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}
const fakeBrandProfile = { id: 'bp-1', user_id: 'user-1' }

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/listings/l1', 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const params = Promise.resolve({ listingId: 'l1' })

describe('GET /api/discovery/listings/[listingId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 404 when listing not found', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getListing).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('LISTING_NOT_FOUND')
  })

  it('returns 200 with listing on success', async () => {
    const fakeListing = { id: 'l1', title: 'Test', status: 'active' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getListing).mockResolvedValue(fakeListing as never)
    const res = await GET(makeRequest('GET'), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeListing)
  })
})

describe('PATCH /api/discovery/listings/[listingId]', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', {}), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'athlete' } as never)
    const res = await PATCH(makeRequest('PATCH', {}), { params })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when brand profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', {}), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('BRAND_PROFILE_NOT_FOUND')
  })

  it('returns 404 when listing not found or not owned', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(updateListing).mockRejectedValue(
      new DiscoveryError('LISTING_NOT_FOUND', 'Not found')
    )
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('LISTING_NOT_FOUND')
  })

  it('returns 200 with updated listing on success', async () => {
    const fakeListing = { id: 'l1', title: 'Updated' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(updateListing).mockResolvedValue(fakeListing as never)
    const res = await PATCH(makeRequest('PATCH', { title: 'Updated' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeListing)
  })
})
