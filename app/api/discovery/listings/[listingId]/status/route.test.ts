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
  return { ...actual, updateListingStatus: vi.fn(), getListing: vi.fn() }
})
vi.mock('@/lib/supabase/entitlements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanCreateListing: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { updateListingStatus, getListing, DiscoveryError } from '@/lib/supabase/discovery'
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
import { PATCH } from './route'

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'brand' as const,
  role_locked_at: '2026-04-19T00:00:00Z',
}
const fakeBrandProfile = { id: 'bp-1', user_id: 'user-1', status: 'active' }
const allowed = { allowed: true, gated: false, tier: null, limit: null, used: 0 }

function makeRequest(body: unknown) {
  return new NextRequest(new URL('/api/discovery/listings/l1/status', 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ listingId: 'l1' })

describe('PATCH /api/discovery/listings/[listingId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    )
    vi.mocked(getUser).mockResolvedValue(fakeUser as never)
    vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
    vi.mocked(assertCanCreateListing).mockResolvedValue(allowed as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'paused' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when the user is not a brand', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'athlete' } as never)
    const res = await PATCH(makeRequest({ status: 'paused' }), { params })
    expect(res.status).toBe(403)
  })

  it('rejects an unknown status value with 400', async () => {
    const res = await PATCH(makeRequest({ status: 'banana' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_STATUS')
    expect(updateListingStatus).not.toHaveBeenCalled()
  })

  it('pauses a listing and returns the updated row', async () => {
    vi.mocked(updateListingStatus).mockResolvedValue({ id: 'l1', status: 'paused' } as never)
    const res = await PATCH(makeRequest({ status: 'paused' }), { params })
    expect(res.status).toBe(200)
    expect(updateListingStatus).toHaveBeenCalledWith({}, 'l1', 'bp-1', 'paused')
    const json = await res.json()
    expect(json.status).toBe('paused')
  })

  it('maps an illegal transition to a 409', async () => {
    vi.mocked(updateListingStatus).mockRejectedValue(
      new DiscoveryError('INVALID_STATUS_TRANSITION', 'A closed listing cannot be changed to active.')
    )
    const res = await PATCH(makeRequest({ status: 'active' }), { params })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_STATUS_TRANSITION')
  })

  // WS-LISTING-04: resuming re-consumes a tier slot, so it is entitlement-gated.
  it('returns 402 when resuming would exceed the tier active-listing cap', async () => {
    vi.mocked(getListing).mockResolvedValue({ id: 'l1', brand_id: 'bp-1', status: 'paused' } as never)
    vi.mocked(assertCanCreateListing).mockResolvedValue({
      allowed: false,
      gated: true,
      tier: 1,
      limit: 3,
      used: 3,
      reason: 'LIMIT_REACHED',
    } as never)
    const res = await PATCH(makeRequest({ status: 'active' }), { params })
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error.code).toBe('LIMIT_REACHED')
    expect(updateListingStatus).not.toHaveBeenCalled()
  })

  it('does not run the entitlement gate for a non-activation transition', async () => {
    vi.mocked(updateListingStatus).mockResolvedValue({ id: 'l1', status: 'filled' } as never)
    const res = await PATCH(makeRequest({ status: 'filled' }), { params })
    expect(res.status).toBe(200)
    expect(assertCanCreateListing).not.toHaveBeenCalled()
    expect(getListing).not.toHaveBeenCalled()
  })
})
