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
  return { ...actual, publishListing: vi.fn() }
})
vi.mock('@/lib/supabase/entitlements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanCreateListing: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { publishListing, DiscoveryError } from '@/lib/supabase/discovery'
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
import { POST } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}
const fakeBrandProfile = { id: 'bp-1', user_id: 'user-1', status: 'active' }
const allowed = { allowed: true, gated: false, tier: null, limit: null, used: 0 }

function makeRequest() {
  return new NextRequest(new URL('/api/discovery/listings/l1/publish', 'http://localhost'), {
    method: 'POST',
  })
}

const params = Promise.resolve({ listingId: 'l1' })

describe('POST /api/discovery/listings/[listingId]/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
    vi.mocked(assertCanCreateListing).mockResolvedValue(allowed as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 when user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'athlete' } as never)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when brand profile does not exist', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(null)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('BRAND_PROFILE_NOT_FOUND')
  })

  // PM-22: a pending / suspended / rejected brand must not publish.
  it('returns 403 BRAND_NOT_APPROVED when the brand is not approved', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue({ ...fakeBrandProfile, status: 'pending_approval' } as never)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('BRAND_NOT_APPROVED')
    expect(publishListing).not.toHaveBeenCalled()
  })

  // WS-LISTING-04: the entitlement gate now runs on publish, not just create.
  it('returns 402 when the tier active-listing cap is reached', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(assertCanCreateListing).mockResolvedValue({
      allowed: false,
      gated: true,
      tier: 1,
      limit: 3,
      used: 3,
      reason: 'LIMIT_REACHED',
    } as never)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error.code).toBe('LIMIT_REACHED')
    expect(publishListing).not.toHaveBeenCalled()
  })

  it('returns 404 when listing not found or not owned', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(publishListing).mockRejectedValue(
      new DiscoveryError('LISTING_NOT_FOUND', 'Not found')
    )
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('LISTING_NOT_FOUND')
  })

  it('returns 200 with success on publish', async () => {
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(publishListing).mockResolvedValue(undefined)
    const res = await POST(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
