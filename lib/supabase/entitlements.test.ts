import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

vi.mock('@/lib/supabase/payments', async (io) => {
  const actual = await io<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getSubscriptionForUser: vi.fn() }
})

import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { assertCanSendConnectionRequest, assertCanSendMessage } from './entitlements'

// Minimal client whose count query (`.select(_, {count,head}).eq().gte()`) resolves { count }.
function clientReturningCount(count: number): SupabaseClient<Database> {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) chain[m] = vi.fn(() => chain)
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ count, error: null }).then(resolve)
  // cast: hand-rolled stand-in for the PostgREST builder used only in tests
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>
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
})
