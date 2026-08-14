import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

vi.mock('@/lib/supabase/payments', async (io) => {
  const actual = await io<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getSubscriptionForUser: vi.fn() }
})

import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { assertCanSendConnectionRequest, assertCanSendMessage, assertCanCreateListing, getEntitlementUsage } from './entitlements'

// Minimal client whose count query (`.select(_, {count,head}).eq().gte()`) resolves { count }.
// Records calls to from/eq/gte for verification of query structure.
function clientReturningCount(count: number | null, error: unknown = null): SupabaseClient<Database> {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) {
    chain[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return chain
    })
  }
  // cast: hand-rolled thenable stand-in for the PostgREST builder used only in tests
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ count, error }).then(resolve)
  // cast: this hand-rolled stub only implements the from/select/eq/gte chain the
  // functions under test actually call, not the full SupabaseClient surface
  const client = { from: vi.fn((table: string) => {
    calls.push({ method: 'from', args: [table] })
    return chain
  }), _testCalls: calls } as unknown as SupabaseClient<Database>
  return client
}

const sub = (over: Record<string, unknown> = {}) => ({
  brand_id: 'bp1', tier: 1, status: 'active',
  current_period_start: '2026-08-01T00:00:00Z', current_period_end: '2026-09-01T00:00:00Z',
  ...over,
})

beforeEach(() => vi.mocked(getSubscriptionForUser).mockReset())

describe('entitlement guards', () => {
  it('allows a non-brand actor without gating and without a DB read', async () => {
    const res = await assertCanSendConnectionRequest(clientReturningCount(0), 'u1', 'athlete')
    expect(res).toMatchObject({ allowed: true, gated: false })
    expect(getSubscriptionForUser).not.toHaveBeenCalled()
  })

  it('blocks a brand with no active subscription', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null as never)
    const res = await assertCanSendConnectionRequest(clientReturningCount(0), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: false, gated: true, reason: 'NO_SUBSCRIPTION' })
  })

  it('blocks a past_due brand', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub({ status: 'past_due' }) as never)
    const res = await assertCanSendConnectionRequest(clientReturningCount(0), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: false, reason: 'NO_SUBSCRIPTION' })
  })

  it('allows a Starter brand under the 15-request cap', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const res = await assertCanSendConnectionRequest(clientReturningCount(14), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: true, limit: 15, used: 14, tier: 1 })
  })

  it('blocks a Starter brand at the 15-request cap', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const res = await assertCanSendConnectionRequest(clientReturningCount(15), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED', limit: 15, used: 15 })
  })

  it('treats Enterprise messaging as unlimited (no count query)', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub({ tier: 3 }) as never)
    const res = await assertCanSendMessage(clientReturningCount(9999), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: true, limit: null, tier: 3 })
  })

  it('allows a Starter brand under the 3-listing cap', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const res = await assertCanCreateListing(clientReturningCount(2), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: true, limit: 3, used: 2, tier: 1 })
  })

  it('blocks a Starter brand at the 3-listing cap', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const res = await assertCanCreateListing(clientReturningCount(3), 'u1', 'brand')
    expect(res).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED', limit: 3, used: 3 })
  })

  it('verifies request count query filters by sender_id and billing window', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const client = clientReturningCount(5)
    await assertCanSendConnectionRequest(client, 'u1', 'brand')
    const calls = (client as unknown as { _testCalls: Array<{ method: string; args: unknown[] }> })._testCalls
    expect(calls).toContainEqual({ method: 'from', args: ['connection_requests'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['sender_id', 'u1'] })
    expect(calls).toContainEqual({ method: 'gte', args: ['created_at', '2026-08-01T00:00:00Z'] })
  })

  it('verifies listing count query filters by brand_id and active status', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const client = clientReturningCount(1)
    await assertCanCreateListing(client, 'u1', 'brand')
    const calls = (client as unknown as { _testCalls: Array<{ method: string; args: unknown[] }> })._testCalls
    expect(calls).toContainEqual({ method: 'from', args: ['job_listings'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'bp1'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['status', 'active'] })
  })

  it('propagates count query errors', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const testError = { code: 'PGRST301', message: 'Invalid table' }
    const client = clientReturningCount(null, testError)
    await expect(assertCanSendConnectionRequest(client, 'u1', 'brand')).rejects.toEqual(testError)
  })
})

describe('getEntitlementUsage', () => {
  it('returns null when there is no active subscription', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null as never)
    const res = await getEntitlementUsage(clientReturningCount(0), 'u1')
    expect(res).toBeNull()
  })

  it('returns null when subscription status is not active/trialing', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub({ status: 'past_due' }) as never)
    const res = await getEntitlementUsage(clientReturningCount(0), 'u1')
    expect(res).toBeNull()
  })

  it('returns full usage object for active Starter subscription', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(sub() as never)
    const client = clientReturningCount(0) // will be reused by the mock for all queries
    // Inject specific counts for each query by replacing the mock's promise
    const subClient = client as unknown as { _testCalls: Array<{ method: string; args: unknown[] }> }
    let callCount = 0
    ;(client as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn((table: string) => {
      subClient._testCalls.push({ method: 'from', args: [table] })
      callCount++
      const result = { count: callCount === 1 ? 5 : callCount === 2 ? 25 : 1, error: null } // requests, messages, listings
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    })
    const res = await getEntitlementUsage(client, 'u1')
    expect(res).toMatchObject({
      tier: 1,
      analytics: false,
      requests: { limit: 15, used: 5 },
      listings: { limit: 3, used: 1 },
      messages: { limit: 100, used: 25 },
    })
  })
})
