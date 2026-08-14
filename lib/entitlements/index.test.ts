import { describe, it, expect } from 'vitest'
import {
  ENTITLEMENTS, TIER_NAMES, TIER_PRICE_GBP, TIER_PRICE_DISPLAY, isTier, featureBullets, COMPARISON_ROWS,
} from './index'

describe('entitlements config', () => {
  it('has the agreed names and prices', () => {
    expect(TIER_NAMES).toEqual({ 1: 'Starter', 2: 'Growth', 3: 'Enterprise' })
    expect(TIER_PRICE_DISPLAY).toEqual({ 1: '£59', 2: '£149', 3: '£299' })
  })

  it('has the agreed numeric GBP prices, the single source for the amount', () => {
    expect(TIER_PRICE_GBP).toEqual({ 1: 59, 2: 149, 3: 299 })
  })

  it('derives TIER_PRICE_DISPLAY from TIER_PRICE_GBP', () => {
    expect(TIER_PRICE_DISPLAY).toEqual({
      1: `£${TIER_PRICE_GBP[1]}`,
      2: `£${TIER_PRICE_GBP[2]}`,
      3: `£${TIER_PRICE_GBP[3]}`,
    })
  })

  it('encodes the agreed limits (null = unlimited)', () => {
    expect(ENTITLEMENTS[1]).toMatchObject({ requests: 15, listings: 3, messages: 100, analytics: false })
    expect(ENTITLEMENTS[2]).toMatchObject({ requests: 60, listings: 10, messages: null, analytics: false, prioritySupport: true })
    expect(ENTITLEMENTS[3]).toMatchObject({ requests: null, listings: null, messages: null, analytics: true, dedicatedManager: true })
  })

  it('isTier narrows valid tiers only', () => {
    expect(isTier(1)).toBe(true)
    expect(isTier(4)).toBe(false)
    expect(isTier(0)).toBe(false)
  })

  it('featureBullets never mentions matching and reflects unlimited', () => {
    const starter = featureBullets(1)
    expect(starter).toContain('15 connection requests / month')
    expect(starter).toContain('Up to 3 active listings')
    expect(starter).toContain('100 messages / month')
    expect(featureBullets(3)).toContain('Unlimited connection requests')
    expect(featureBullets(3)).toContain('Full analytics and reporting')
    for (const t of [1, 2, 3] as const) {
      for (const b of featureBullets(t)) expect(b.toLowerCase()).not.toContain('match')
    }
  })

  it('comparison rows cover the six differentiators', () => {
    expect(COMPARISON_ROWS.map((r) => r.label)).toEqual([
      'Connection requests / month', 'Active listings', 'Messaging',
      'Priority support', 'Dedicated account manager', 'Analytics and reporting',
    ])
  })
})
