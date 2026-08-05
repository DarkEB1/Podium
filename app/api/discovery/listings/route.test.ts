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
  return { ...actual, createListing: vi.fn(), getListings: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { createListing, getListings, DiscoveryError } from '@/lib/supabase/discovery'
import { GET, POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}

const fakeBrandProfile = { id: 'bp-1', user_id: 'user-1', status: 'active' }

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL('/api/discovery/listings', 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/discovery/listings', () => {
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

  it('returns 200 with listings on success', async () => {
    const fakeListings = [{ id: 'l1', title: 'Listing 1', status: 'active' }]
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getListings).mockResolvedValue(fakeListings as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(fakeListings)
  })
})

describe('POST /api/discovery/listings', () => {
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

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'athlete' } as never)
    const res = await POST(makeRequest('POST', { title: 'Test' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when brand profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { title: 'Test' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('BRAND_PROFILE_NOT_FOUND')
  })

  it('returns 201 with created listing on success', async () => {
    const fakeListing = { id: 'l1', brand_id: 'bp-1', title: 'Test', status: 'draft' }
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(createListing).mockResolvedValue(fakeListing as never)
    const res = await POST(makeRequest('POST', { title: 'Test' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(fakeListing)
  })

  // A rejected insert used to escape the handler, so Next answered with a
  // non-JSON 500 and the client's res.json() threw before it could read the
  // failure — the real reason never reached the brand or the logs.
  it('turns a rejected insert into a JSON 400 without the raw Postgres message', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(createListing).mockRejectedValue(
      new DiscoveryError(
        'LISTING_CREATE_FAILED',
        'invalid input syntax for type timestamp with time zone: ""'
      )
    )
    const res = await POST(makeRequest('POST', { title: 'Test', application_deadline: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('LISTING_CREATE_FAILED')
    expect(json.error.message).not.toMatch(/timestamp with time zone/)
    expect(json.error.message).toMatch(/could not save/i)
  })

  it('keeps the status of a known DiscoveryError code', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(createListing).mockRejectedValue(
      new DiscoveryError('LISTING_NOT_FOUND', 'Listing not found or not owned by this brand')
    )
    const res = await POST(makeRequest('POST', { title: 'Test' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.message).toBe('Listing not found or not owned by this brand')
  })
})
