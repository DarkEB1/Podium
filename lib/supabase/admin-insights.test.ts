import { describe, it, expect, vi } from 'vitest'
import { getRevenueOverview, getSubscriptionOverview } from './admin-insights'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function clientReturning(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  }
  return { from: vi.fn(() => builder) } as unknown as SupabaseClient<Database>
}

describe('getRevenueOverview', () => {
  it('sums gross, fees and net and breaks down by status', async () => {
    const client = clientReturning([
      { id: 'p1', amount: 100, platform_fee: 10, net_amount: 90, status: 'succeeded', currency: 'GBP', created_at: '2026-01-02' },
      { id: 'p2', amount: 50, platform_fee: 5, net_amount: 45, status: 'succeeded', currency: 'GBP', created_at: '2026-01-01' },
      { id: 'p3', amount: 30, platform_fee: 0, net_amount: 0, status: 'failed', currency: 'GBP', created_at: '2026-01-03' },
    ])
    const r = await getRevenueOverview(client)
    expect(r.totalGross).toBe(180)
    expect(r.totalPlatformFees).toBe(15)
    expect(r.totalNet).toBe(135)
    expect(r.byStatus.succeeded).toEqual({ count: 2, gross: 150 })
    expect(r.byStatus.failed).toEqual({ count: 1, gross: 30 })
  })
})

describe('getSubscriptionOverview', () => {
  it('counts by tier and status', async () => {
    const client = clientReturning([
      { id: 's1', tier: 1, status: 'active', created_at: '2026-01-01' },
      { id: 's2', tier: 1, status: 'active', created_at: '2026-01-02' },
      { id: 's3', tier: 3, status: 'canceled', created_at: '2026-01-03' },
    ])
    const s = await getSubscriptionOverview(client)
    expect(s.total).toBe(3)
    expect(s.byTier[1]).toBe(2)
    expect(s.byTier[3]).toBe(1)
    expect(s.byStatus.active).toBe(2)
    expect(s.byStatus.canceled).toBe(1)
  })
})
