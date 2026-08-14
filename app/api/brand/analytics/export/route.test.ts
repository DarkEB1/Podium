import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/auth')>()
  return { ...actual, getUser: vi.fn() }
})
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return { ...actual, getSubscriptionForUser: vi.fn(), getBrandProfileIdForUser: vi.fn() }
})
vi.mock('@/lib/supabase/brand-analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/brand-analytics')>()
  return { ...actual, getBrandAnalytics: vi.fn() }
})

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, getBrandProfileIdForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { GET } from './route'

const req = () => new NextRequest(new URL('/api/brand/analytics/export', 'http://localhost'))

const fakeUser = { id: 'u1', email: 'brand@test.com', role: 'brand' as const, role_locked_at: '2026-04-01T00:00:00Z' }

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue({} as never)
  vi.mocked(getUser).mockResolvedValue(fakeUser as never)
  vi.mocked(getBrandProfileIdForUser).mockResolvedValue('bp1' as never)
})

describe('GET /api/brand/analytics/export', () => {
  it('returns 403 when there is no signed-in user', async () => {
    vi.mocked(getUser).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('returns 403 for a non-brand user', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'athlete' } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('returns 403 for a brand with no subscription', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('403 for a non-Enterprise brand', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue({
      tier: 1,
      status: 'active',
      current_period_start: 's',
      current_period_end: 'e',
      brand_id: 'bp1',
    } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('403 for an Enterprise brand whose subscription is canceled', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue({
      tier: 3,
      status: 'canceled',
      current_period_start: 's',
      current_period_end: 'e',
      brand_id: 'bp1',
    } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('returns text/csv for an Enterprise brand', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue({
      tier: 3,
      status: 'active',
      current_period_start: 's',
      current_period_end: 'e',
      brand_id: 'bp1',
    } as never)
    vi.mocked(getBrandAnalytics).mockResolvedValue({
      periodStart: 's',
      periodEnd: 'e',
      funnel: { requestsSent: 4, accepted: 2, declined: 1, responded: 3, messaged: 2 },
      acceptanceRate: 0.5,
      responseRate: 0.75,
      connectedAthletes: 2,
      reachAudience: 6000,
      listings: { active: 1, total: 2 },
      timeSeries: [{ date: '2026-08-01', requestsSent: 2, accepted: 1 }],
    } as never)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const body = await res.text()
    expect(body).toContain('date,requestsSent,accepted')
    expect(body).toContain('2026-08-01,2,1')
  })

  it('escapes CSV fields containing commas, quotes, or newlines', async () => {
    vi.mocked(getSubscriptionForUser).mockResolvedValue({
      tier: 3,
      status: 'trialing',
      current_period_start: 's',
      current_period_end: 'e',
      brand_id: 'bp1',
    } as never)
    vi.mocked(getBrandAnalytics).mockResolvedValue({
      periodStart: 's',
      periodEnd: 'e',
      funnel: { requestsSent: 0, accepted: 0, declined: 0, responded: 0, messaged: 0 },
      acceptanceRate: 0,
      responseRate: 0,
      connectedAthletes: 0,
      reachAudience: 0,
      listings: { active: 0, total: 0 },
      timeSeries: [{ date: 'a,b"c\nd', requestsSent: 1, accepted: 0 }],
    } as never)
    const res = await GET(req())
    const body = await res.text()
    expect(body).toContain('"a,b""c\nd",1,0')
  })
})
