import { describe, it, expect } from 'vitest'
import { MARKET_PROFILES, RALLY_PAIRS, SKYLINE_FILTERS } from './market-fixtures'

describe('market fixtures', () => {
  it('ships 12 demo profiles with unique ids and positive deal counts', () => {
    expect(MARKET_PROFILES).toHaveLength(12)
    expect(new Set(MARKET_PROFILES.map((p) => p.id)).size).toBe(12)
    for (const p of MARKET_PROFILES) expect(p.deals).toBeGreaterThan(0)
  })

  it('covers every skyline filter with at least two profiles', () => {
    for (const f of SKYLINE_FILTERS.filter((f) => f !== 'All')) {
      const match = MARKET_PROFILES.filter((p) =>
        f === 'Teams' ? p.kind === 'team' : p.sport === f
      )
      expect(match.length, `filter ${f}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('ships 4 rally pairs with positive base offers', () => {
    expect(RALLY_PAIRS).toHaveLength(4)
    for (const r of RALLY_PAIRS) expect(r.baseOffer).toBeGreaterThan(0)
  })
})
