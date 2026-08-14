// Single source of truth for subscription tiers. Pure config: no DB, no Stripe.
// Safe to import from client or server code.

export type Tier = 1 | 2 | 3
export const TIERS: readonly Tier[] = [1, 2, 3] as const
export const POPULAR_TIER: Tier = 2

export const TIER_NAMES: Record<Tier, string> = { 1: 'Starter', 2: 'Growth', 3: 'Enterprise' }
export const TIER_PRICE_DISPLAY: Record<Tier, string> = { 1: '£59', 2: '£149', 3: '£299' }
export const TIER_TAGLINE: Record<Tier, string> = {
  1: 'For brands getting started with athlete partnerships.',
  2: 'For growing brands running multiple campaigns.',
  3: 'For agencies and brands operating at scale.',
}

export interface Entitlement {
  requests: number | null // connection requests per billing period; null = unlimited
  listings: number | null // active listings at once; null = unlimited
  messages: number | null // messages sent per billing period; null = unlimited
  analytics: boolean
  prioritySupport: boolean
  dedicatedManager: boolean
}

export const ENTITLEMENTS: Record<Tier, Entitlement> = {
  1: { requests: 15, listings: 3, messages: 100, analytics: false, prioritySupport: false, dedicatedManager: false },
  2: { requests: 60, listings: 10, messages: null, analytics: false, prioritySupport: true, dedicatedManager: false },
  3: { requests: null, listings: null, messages: null, analytics: true, prioritySupport: true, dedicatedManager: true },
}

export function isTier(value: number): value is Tier {
  return value === 1 || value === 2 || value === 3
}

// Marketing bullet list per tier. No matching-breadth claim (dropped by decision).
export function featureBullets(tier: Tier): string[] {
  const e = ENTITLEMENTS[tier]
  const bullets: string[] = [
    e.requests === null ? 'Unlimited connection requests' : `${e.requests} connection requests / month`,
    e.listings === null ? 'Unlimited active listings' : `Up to ${e.listings} active listings`,
    e.messages === null ? 'Unlimited messaging' : `${e.messages} messages / month`,
    'Search and filters',
  ]
  if (e.prioritySupport && !e.dedicatedManager) bullets.push('Priority support')
  if (e.dedicatedManager) bullets.push('Dedicated account manager')
  if (e.analytics) bullets.push('Full analytics and reporting')
  return bullets
}

export interface ComparisonRow {
  label: string
  values: Record<Tier, string | boolean>
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Connection requests / month', values: { 1: '15', 2: '60', 3: 'Unlimited' } },
  { label: 'Active listings', values: { 1: '3', 2: '10', 3: 'Unlimited' } },
  { label: 'Messaging', values: { 1: '100 / month', 2: 'Unlimited', 3: 'Unlimited' } },
  { label: 'Priority support', values: { 1: false, 2: true, 3: true } },
  { label: 'Dedicated account manager', values: { 1: false, 2: false, 3: true } },
  { label: 'Analytics and reporting', values: { 1: false, 2: false, 3: true } },
]
