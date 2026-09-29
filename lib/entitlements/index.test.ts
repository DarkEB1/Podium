import { describe, it, expect } from 'vitest'
import {
  ENTITLEMENTS, TIER_NAMES, TIER_PRICE_GBP, TIER_PRICE_DISPLAY, TIER_TAGLINE, POPULAR_TIER, UNLIMITED_TIER,
  GROWTH_UPSELL_NUDGE, UNLIMITED_STEP_UP_DISPLAY, TIER_HIGHLIGHTS,
  isTier, hasFullSearch, formatGbp, featureBullets, COMPARISON_ROWS,
} from './index'

describe('entitlements config', () => {
  it('has the agreed names and prices', () => {
    expect(TIER_NAMES).toEqual({ 1: 'Starter', 2: 'Growth', 3: 'Unlimited' })
    expect(TIER_PRICE_DISPLAY).toEqual({ 1: '£49', 2: '£99.99', 3: '£129' })
  })

  it('has the agreed numeric GBP prices, the single source for the amount', () => {
    expect(TIER_PRICE_GBP).toEqual({ 1: 49, 2: 99.99, 3: 129 })
  })

  it('derives TIER_PRICE_DISPLAY from TIER_PRICE_GBP', () => {
    expect(TIER_PRICE_DISPLAY).toEqual({
      1: formatGbp(TIER_PRICE_GBP[1]),
      2: formatGbp(TIER_PRICE_GBP[2]),
      3: formatGbp(TIER_PRICE_GBP[3]),
    })
  })

  it('formatGbp keeps whole pounds short and pence exact', () => {
    expect(formatGbp(49)).toBe('£49')
    expect(formatGbp(99.99)).toBe('£99.99')
    expect(formatGbp(129 - 99.99)).toBe('£29.01')
    expect(formatGbp(99.99 - 49)).toBe('£50.99')
  })

  it('puts the badge and the primary button on Unlimited, with the £29 nudge on Growth', () => {
    expect(POPULAR_TIER).toBe(3)
    expect(UNLIMITED_TIER).toBe(3)
    expect(UNLIMITED_STEP_UP_DISPLAY).toBe('£29')
    expect(GROWTH_UPSELL_NUDGE).toBe('Just £29 more for unlimited')
    expect(TIER_TAGLINE[3]).toBe('Unlimited sponsorship, for £29 more than Growth.')
    expect(TIER_HIGHLIGHTS[3]).toEqual(['Best value'])
  })

  it('encodes the agreed limits (null = unlimited)', () => {
    expect(ENTITLEMENTS[1]).toMatchObject({ requests: 3, listings: 1, messages: 20, fullSearch: false, analytics: false })
    expect(ENTITLEMENTS[2]).toMatchObject({ requests: 20, listings: 3, messages: 150, fullSearch: true, analytics: false, verifiedBadge: false })
    expect(ENTITLEMENTS[3]).toMatchObject({
      requests: null, listings: null, messages: null,
      fullSearch: true, verifiedBadge: true, featured: true, analytics: true, prioritySupport: true, onboardingCall: true,
    })
  })

  it('isTier narrows valid tiers only', () => {
    expect(isTier(1)).toBe(true)
    expect(isTier(4)).toBe(false)
    expect(isTier(0)).toBe(false)
  })

  it('hasFullSearch limits Starter only and never gates an unknown tier', () => {
    expect(hasFullSearch(1)).toBe(false)
    expect(hasFullSearch(2)).toBe(true)
    expect(hasFullSearch(3)).toBe(true)
    expect(hasFullSearch(undefined)).toBe(true)
    expect(hasFullSearch(null)).toBe(true)
  })

  it('featureBullets matches the agreed card copy per tier', () => {
    expect(featureBullets(1)).toEqual([
      '3 connection requests / month',
      '1 active listing',
      '20 messages / month',
      'Search by sport and location only',
    ])
    expect(featureBullets(2)).toEqual([
      '20 connection requests / month',
      '3 active listings',
      '150 messages / month',
      'Full search and filters',
    ])
    expect(featureBullets(3)).toEqual([
      'Unlimited connection requests',
      'Unlimited active listings',
      'Unlimited messaging',
      'Full search and filters',
      'Verified brand badge',
      'Featured to athletes in your area',
      'Analytics and reporting',
      'Priority support and an onboarding call',
    ])
  })

  it('featureBullets never mentions matching', () => {
    for (const t of [1, 2, 3] as const) {
      for (const b of featureBullets(t)) expect(b.toLowerCase()).not.toContain('match')
    }
  })

  it('comparison rows cover the eight differentiators and derive limits from the config', () => {
    expect(COMPARISON_ROWS.map((r) => r.label)).toEqual([
      'Connection requests / month', 'Active listings', 'Messaging', 'Search and filters',
      'Verified brand badge', 'Featured to athletes in your area', 'Analytics and reporting',
      'Priority support and onboarding call',
    ])
    expect(COMPARISON_ROWS[0]!.values).toEqual({ 1: '3', 2: '20', 3: 'Unlimited' })
    expect(COMPARISON_ROWS[2]!.values).toEqual({ 1: '20 / month', 2: '150 / month', 3: 'Unlimited' })
  })
})
