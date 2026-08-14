import { describe, it, expect } from 'vitest'
import { computeFunnel, audienceOf, buildTimeSeries } from './brand-analytics'

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
