import { describe, it, expect, vi } from 'vitest'
import { computeFunnel, audienceOf, buildTimeSeries, getBrandAnalytics } from './brand-analytics'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

describe('brand-analytics pure helpers', () => {
  it('audienceOf takes the max platform figure, coercing strings', () => {
    expect(audienceOf({ instagram_followers: 1000, tiktok_followers: '5000', youtube_subscribers: 200 })).toBe(5000)
    expect(audienceOf(null)).toBe(0)
    expect(audienceOf({ nonsense: 'x' })).toBe(0)
  })

  it('computeFunnel derives counts and rates', () => {
    const rows = [
      { status: 'accepted', responded_at: '2026-08-02T00:00:00Z' },
      { status: 'declined', responded_at: '2026-08-03T00:00:00Z' },
      { status: 'pending', responded_at: null },
      { status: 'accepted', responded_at: '2026-08-04T00:00:00Z' },
    ]
    const f = computeFunnel(rows, 2)
    expect(f.funnel).toMatchObject({ requestsSent: 4, accepted: 2, declined: 1, responded: 3, messaged: 2 })
    expect(f.acceptanceRate).toBeCloseTo(0.5)
    expect(f.responseRate).toBeCloseTo(0.75)
  })

  it('buildTimeSeries buckets by UTC day', () => {
    const rows = [
      { status: 'accepted', created_at: '2026-08-01T09:00:00Z' },
      { status: 'pending', created_at: '2026-08-01T18:00:00Z' },
      { status: 'accepted', created_at: '2026-08-02T10:00:00Z' },
    ]
    const ts = buildTimeSeries(rows)
    expect(ts).toEqual([
      { date: '2026-08-01', requestsSent: 2, accepted: 1 },
      { date: '2026-08-02', requestsSent: 1, accepted: 1 },
    ])
  })
})

/**
 * Mocked-client coverage for `getBrandAnalytics` itself. Its `(c as SupabaseClient)`
 * cast drops the Database generic (see brand-analytics.ts), so `type-check` cannot
 * catch a wrong table or column name in the query chain — only a test exercising the
 * actual `.from(...)` calls can. Mock style follows lib/supabase/admin-insights.test.ts:
 * a chainable builder whose methods return itself and record their args, resolved by
 * making the builder thenable (Supabase's real query builder is itself awaitable at
 * any point in the chain, not just after a terminal call).
 */
interface RecordedCall {
  method: string
  args: unknown[]
}

interface QueryStep {
  table: string
  response: { data?: unknown; error?: null; count?: number }
}

function mockAnalyticsClient(steps: QueryStep[]) {
  const log: Array<{ table: string; calls: RecordedCall[] }> = []
  let i = 0
  const from = vi.fn((table: string) => {
    const step = steps[i]
    i += 1
    if (!step) throw new Error(`Unexpected extra from('${table}') call (step ${i})`)
    const calls: RecordedCall[] = []
    const record = (method: string) => (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
    const builder: Record<string, unknown> = {
      select: vi.fn(record('select')),
      eq: vi.fn(record('eq')),
      gte: vi.fn(record('gte')),
      lte: vi.fn(record('lte')),
      in: vi.fn(record('in')),
      // Thenable: the code sometimes awaits the chain right after `.eq()`/`.in()`
      // with no terminal call, exactly like the real postgrest-js builder.
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(step.response).then(resolve, reject),
    }
    log.push({ table, calls })
    return builder
  })
  const client = { from } as unknown as SupabaseClient<Database>
  return { client, from, log }
}

describe('getBrandAnalytics', () => {
  const brandUserId = 'brand-user-1'
  const brandProfileId = 'brand-profile-1'
  const periodStart = '2026-08-01T00:00:00Z'
  const periodEnd = '2026-08-03T00:00:00Z'

  function buildClient() {
    return mockAnalyticsClient([
      // 1. connection_requests, sent in-period (funnel + time-series)
      {
        table: 'connection_requests',
        response: {
          data: [
            { status: 'accepted', responded_at: '2026-08-01T09:30:00Z', created_at: '2026-08-01T09:00:00Z', recipient_id: 'ath-1' },
            { status: 'declined', responded_at: '2026-08-01T20:00:00Z', created_at: '2026-08-01T18:00:00Z', recipient_id: 'ath-2' },
            { status: 'pending', responded_at: null, created_at: '2026-08-02T10:00:00Z', recipient_id: 'ath-3' },
            { status: 'accepted', responded_at: '2026-08-02T12:00:00Z', created_at: '2026-08-02T11:00:00Z', recipient_id: 'ath-4' },
          ],
          error: null,
        },
      },
      // 2. messages, sent in-period
      {
        table: 'messages',
        response: {
          data: [{ match_id: 'm1' }, { match_id: 'm1' }, { match_id: 'm2' }],
          error: null,
        },
      },
      // 3. connection_requests, all-time accepted (reach)
      {
        table: 'connection_requests',
        response: {
          data: [{ recipient_id: 'ath-1' }, { recipient_id: 'ath-4' }, { recipient_id: 'ath-1' }],
          error: null,
        },
      },
      // 4. athlete_profiles, for the connected athletes
      {
        table: 'athlete_profiles',
        response: {
          data: [
            { social_accounts: { instagram_followers: 1000, tiktok_followers: '5000' } },
            { social_accounts: { youtube_subscribers: 200, twitter_followers: 300 } },
          ],
          error: null,
        },
      },
      // 5. job_listings, total
      { table: 'job_listings', response: { count: 7, data: null, error: null } },
      // 6. job_listings, active
      { table: 'job_listings', response: { count: 3, data: null, error: null } },
    ])
  }

  it('assembles funnel, rates, reach, listings and time-series from the four queries', async () => {
    const { client } = buildClient()
    const result = await getBrandAnalytics(client, brandUserId, brandProfileId, periodStart, periodEnd)

    expect(result).toEqual({
      periodStart,
      periodEnd,
      funnel: { requestsSent: 4, accepted: 2, declined: 1, responded: 3, messaged: 2 },
      acceptanceRate: 0.5,
      responseRate: 0.75,
      connectedAthletes: 2,
      // MAX-per-athlete summed: ath-1 -> max(1000, 5000) = 5000; ath-4 -> max(200, 300) = 300.
      reachAudience: 5300,
      listings: { active: 3, total: 7 },
      timeSeries: [
        { date: '2026-08-01', requestsSent: 2, accepted: 1 },
        { date: '2026-08-02', requestsSent: 2, accepted: 1 },
      ],
    })
  })

  it('queries the right tables and filter columns (catches a typo\'d table/column type-check cannot see)', async () => {
    const { client, from, log } = buildClient()
    await getBrandAnalytics(client, brandUserId, brandProfileId, periodStart, periodEnd)

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'connection_requests',
      'messages',
      'connection_requests',
      'athlete_profiles',
      'job_listings',
      'job_listings',
    ])

    // Non-null assertions: `log` was just asserted to have exactly 6 entries above
    // (tsconfig's noUncheckedIndexedAccess otherwise types every index as possibly
    // undefined), matching the established idiom in e.g. lib/supabase/discovery.test.ts.
    const [funnelQuery, messagesQuery, reachQuery, profilesQuery, totalListingsQuery, activeListingsQuery] = [
      log[0]!,
      log[1]!,
      log[2]!,
      log[3]!,
      log[4]!,
      log[5]!,
    ]

    // 1. Funnel query: this brand's outreach, bounded to the period.
    expect(funnelQuery.calls).toContainEqual({ method: 'eq', args: ['sender_id', brandUserId] })
    expect(funnelQuery.calls).toContainEqual({ method: 'gte', args: ['created_at', periodStart] })
    expect(funnelQuery.calls).toContainEqual({ method: 'lte', args: ['created_at', periodEnd] })

    // 2. Messages query: this brand's sends, bounded to the period.
    expect(messagesQuery.calls).toContainEqual({ method: 'eq', args: ['sender_id', brandUserId] })
    expect(messagesQuery.calls).toContainEqual({ method: 'gte', args: ['created_at', periodStart] })
    expect(messagesQuery.calls).toContainEqual({ method: 'lte', args: ['created_at', periodEnd] })

    // 3. Reach query: all-time accepted connections for this brand.
    expect(reachQuery.calls).toContainEqual({ method: 'eq', args: ['sender_id', brandUserId] })
    expect(reachQuery.calls).toContainEqual({ method: 'eq', args: ['status', 'accepted'] })

    // 4. Athlete profiles for the distinct connected athletes, in insertion order.
    expect(profilesQuery.calls).toContainEqual({ method: 'in', args: ['user_id', ['ath-1', 'ath-4']] })

    // 5. Total listings for this brand's profile.
    expect(totalListingsQuery.calls).toContainEqual({ method: 'eq', args: ['brand_id', brandProfileId] })

    // 6. Active listings for this brand's profile.
    expect(activeListingsQuery.calls).toContainEqual({ method: 'eq', args: ['brand_id', brandProfileId] })
    expect(activeListingsQuery.calls).toContainEqual({ method: 'eq', args: ['status', 'active'] })
  })
})
