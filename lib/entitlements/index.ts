// Single source of truth for subscription tiers. Pure config: no DB, no Stripe.
// Safe to import from client or server code.

export type Tier = 1 | 2 | 3
export const TIERS: readonly Tier[] = [1, 2, 3] as const
/** The tier that carries the "Most popular" badge and the primary button. */
export const POPULAR_TIER: Tier = 3
/** The top tier: every cap lifted, plus the visible extras (badge, featured). */
export const UNLIMITED_TIER: Tier = 3

export const TIER_NAMES: Record<Tier, string> = { 1: 'Starter', 2: 'Growth', 3: 'Unlimited' }

// Numeric GBP price is the single source of truth for the amount; the
// display strings below derive from it so the two can never drift apart.
export const TIER_PRICE_GBP: Record<Tier, number> = { 1: 49, 2: 99.99, 3: 129 }

/** "£49" for whole pounds, "£99.99" otherwise. Never "£29.010000000000005". */
export function formatGbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return Number.isInteger(rounded) ? `£${rounded}` : `£${rounded.toFixed(2)}`
}

export const TIER_PRICE_DISPLAY: Record<Tier, string> = {
  1: formatGbp(TIER_PRICE_GBP[1]),
  2: formatGbp(TIER_PRICE_GBP[2]),
  3: formatGbp(TIER_PRICE_GBP[3]),
}

/**
 * The Growth-to-Unlimited gap, rounded to whole pounds for marketing copy
 * ("Just £29 more for unlimited"). Billing screens use formatGbp on the exact
 * difference instead.
 */
export const UNLIMITED_STEP_UP_GBP = Math.round(TIER_PRICE_GBP[UNLIMITED_TIER] - TIER_PRICE_GBP[2])
export const UNLIMITED_STEP_UP_DISPLAY = `£${UNLIMITED_STEP_UP_GBP}`
/** Shown next to the Growth button: the nudge onto Unlimited. */
export const GROWTH_UPSELL_NUDGE = `Just ${UNLIMITED_STEP_UP_DISPLAY} more for unlimited`

export const TIER_TAGLINE: Record<Tier, string> = {
  1: 'Try Podium with one campaign.',
  2: 'For brands running a few campaigns.',
  3: `Unlimited sponsorship, for ${UNLIMITED_STEP_UP_DISPLAY} more than Growth.`,
}

/** Extra marketing labels on the top tier's card, after "Most popular". */
export const TIER_HIGHLIGHTS: Record<Tier, string[]> = { 1: [], 2: [], 3: ['Best value'] }

export interface Entitlement {
  requests: number | null // connection requests per billing period; null = unlimited
  listings: number | null // active listings at once; null = unlimited
  messages: number | null // messages sent per billing period; null = unlimited
  /** false = discovery filters limited to sport and location only */
  fullSearch: boolean
  /** Brand shows a Verified badge to athletes for as long as the plan is active */
  verifiedBadge: boolean
  /** Brand's listings are featured to athletes in the listing's area */
  featured: boolean
  analytics: boolean
  prioritySupport: boolean
  onboardingCall: boolean
}

export const ENTITLEMENTS: Record<Tier, Entitlement> = {
  1: {
    requests: 3, listings: 1, messages: 20,
    fullSearch: false, verifiedBadge: false, featured: false,
    analytics: false, prioritySupport: false, onboardingCall: false,
  },
  2: {
    requests: 20, listings: 3, messages: 150,
    fullSearch: true, verifiedBadge: false, featured: false,
    analytics: false, prioritySupport: false, onboardingCall: false,
  },
  3: {
    requests: null, listings: null, messages: null,
    fullSearch: true, verifiedBadge: true, featured: true,
    analytics: true, prioritySupport: true, onboardingCall: true,
  },
}

export function isTier(value: number): value is Tier {
  return value === 1 || value === 2 || value === 3
}

/** Tiers whose discovery filters are limited to sport and location. */
export function hasFullSearch(tier: number | null | undefined): boolean {
  return isTier(tier ?? 0) ? ENTITLEMENTS[tier as Tier].fullSearch : true
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

// Marketing bullet list per tier. No matching-breadth claim (dropped by decision).
export function featureBullets(tier: Tier): string[] {
  const e = ENTITLEMENTS[tier]
  const bullets: string[] = [
    e.requests === null ? 'Unlimited connection requests' : `${e.requests} connection requests / month`,
    e.listings === null ? 'Unlimited active listings' : plural(e.listings, 'active listing', 'active listings'),
    e.messages === null ? 'Unlimited messaging' : `${e.messages} messages / month`,
    e.fullSearch ? 'Full search and filters' : 'Search by sport and location only',
  ]
  if (e.verifiedBadge) bullets.push('Verified brand badge')
  if (e.featured) bullets.push('Featured to athletes in your area')
  if (e.analytics) bullets.push('Analytics and reporting')
  if (e.prioritySupport && e.onboardingCall) bullets.push('Priority support and an onboarding call')
  else if (e.prioritySupport) bullets.push('Priority support')
  return bullets
}

export interface ComparisonRow {
  label: string
  values: Record<Tier, string | boolean>
}

function limitCell(n: number | null, suffix = ''): string {
  return n === null ? 'Unlimited' : `${n}${suffix}`
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Connection requests / month', values: { 1: limitCell(ENTITLEMENTS[1].requests), 2: limitCell(ENTITLEMENTS[2].requests), 3: limitCell(ENTITLEMENTS[3].requests) } },
  { label: 'Active listings', values: { 1: limitCell(ENTITLEMENTS[1].listings), 2: limitCell(ENTITLEMENTS[2].listings), 3: limitCell(ENTITLEMENTS[3].listings) } },
  { label: 'Messaging', values: { 1: limitCell(ENTITLEMENTS[1].messages, ' / month'), 2: limitCell(ENTITLEMENTS[2].messages, ' / month'), 3: limitCell(ENTITLEMENTS[3].messages) } },
  { label: 'Search and filters', values: { 1: 'Sport and location', 2: 'Full', 3: 'Full' } },
  { label: 'Verified brand badge', values: { 1: false, 2: false, 3: true } },
  { label: 'Featured to athletes in your area', values: { 1: false, 2: false, 3: true } },
  { label: 'Analytics and reporting', values: { 1: false, 2: false, 3: true } },
  { label: 'Priority support and onboarding call', values: { 1: false, 2: false, 3: true } },
]
