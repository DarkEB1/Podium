# Pricing tiers + real entitlement enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the £59/£149/£299 Starter/Growth/Enterprise tiers with limits that are actually enforced (connection requests, active listings, Starter messaging), a gated Enterprise analytics dashboard, honest pricing copy, and test-mode Stripe prices.

**Architecture:** One pure config module (`lib/entitlements`) is the single source of truth for tier names, prices, limits, and marketing copy. A DB-backed guard module (`lib/supabase/entitlements.ts`) counts usage within the subscription's billing period and is called by the three write routes. The Enterprise analytics dashboard is a new brand server page reading a new `lib/supabase/brand-analytics.ts`. No schema migration is required: enforcement counts existing rows since `subscriptions.current_period_start`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase JS, Vitest, Stripe (test mode), hand-rolled SVG charts (no chart library is installed and none is added).

## Global Constraints

- No Supabase calls outside `lib/supabase/`. Data functions take the client as their first parameter (`supabase: SupabaseClient<Database>`); callers create it via `createClient()` from `@/lib/supabase/server`.
- No Stripe calls outside `lib/stripe/`. Never create live-mode Stripe objects; never change Production env vars. Test-mode Stripe and Preview (staging) env only.
- No `any`. Every `as Type` needs a comment. DB types come from `types/database.ts`, never inlined.
- Error responses use the shape `{ error: { code: string, message: string } }` with an HTTP status. Blocked-by-entitlement returns **HTTP 402**.
- Copy strings (pricing, UI) must contain no em dashes and no AI tell-tale phrasing.
- Tier is the integer 1/2/3. Names: 1=Starter, 2=Growth, 3=Enterprise. Prices: £59/£149/£299. Popular tier = 2.
- Limits: requests 15/60/unlimited, active listings 3/10/unlimited, messages 100/unlimited/unlimited. Analytics: Enterprise only. Priority support: Growth+Enterprise (display only). Dedicated manager: Enterprise (display only).
- Only `brand`-role actors are gated. A brand with no `active`/`trialing` subscription is blocked from gated actions. Non-brand actors are never gated.
- Billing-period window for counting = `subscriptions.current_period_start` to now. No new columns, no reset cron.
- The matching-breadth claim ("exact-match / 3-of-5 / 1-of-5") is dropped from all copy, not built.
- Brand top-level nav has a hard budget of exactly 4 items (feeds the mobile `grid-cols-4` bar). Do NOT add Analytics to `NAV_ITEMS`; surface it via a dashboard entry card.
- `lib/routes.test.ts` walks `app/` and asserts every static `ROUTES` string resolves to a real `page.tsx`/`route.ts`. Create a page file BEFORE adding its `ROUTES` entry.
- Before done: `npm run test` passing, `npm run type-check` clean, `npm run lint` clean (`npm run check`), and the change seen working on the staging URL.

**Key schema facts (verified):**
- `connection_requests(id, sender_id→users.id, recipient_id→users.id, status[pending|accepted|declined|withdrawn], message, sent_at, responded_at, created_at)`. No `listing_id`.
- `job_listings(id, brand_id→brand_profiles.id, status[draft|active|paused|expired|filled], ..., created_at)`. "active" = literal `'active'`.
- `messages(id, match_id→matches.id, sender_id→users.id, content_type, ..., sent_at, created_at)`.
- `matches(id, user_a_id, user_b_id, connection_request_id, status, ...)`. No listing FK. Created by a DB trigger when a connection_request becomes `accepted`.
- `subscriptions(brand_id→brand_profiles.id UNIQUE, tier int check(1..3), status, current_period_start, current_period_end, ...)`.
- `brand_profiles.user_id` UNIQUE → users.id. `athlete_profiles.user_id` UNIQUE → users.id. Athlete audience = `max(social_accounts.{instagram_followers,tiktok_followers,youtube_subscribers,twitter_followers})` (a JSON blob; max across platforms, not sum).
- `getSubscriptionForUser(supabase, userId): Promise<SubscriptionRow | null>` and `getBrandProfileIdForUser(supabase, userId): Promise<string | null>` live in `lib/supabase/payments.ts`. `SubscriptionRow.brand_id` is the `brand_profiles.id`.

---

### Task 1: `lib/entitlements` — pure config + display helpers

**Files:**
- Create: `lib/entitlements/index.ts`
- Test: `lib/entitlements/index.test.ts`

**Interfaces:**
- Produces: `Tier`, `TIERS`, `POPULAR_TIER`, `TIER_NAMES`, `TIER_PRICE_DISPLAY`, `TIER_TAGLINE`, `Entitlement`, `ENTITLEMENTS`, `isTier(n): n is Tier`, `featureBullets(tier): string[]`, `ComparisonRow`, `COMPARISON_ROWS`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/entitlements/index.test.ts
import { describe, it, expect } from 'vitest'
import {
  ENTITLEMENTS, TIER_NAMES, TIER_PRICE_DISPLAY, isTier, featureBullets, COMPARISON_ROWS,
} from './index'

describe('entitlements config', () => {
  it('has the agreed names and prices', () => {
    expect(TIER_NAMES).toEqual({ 1: 'Starter', 2: 'Growth', 3: 'Enterprise' })
    expect(TIER_PRICE_DISPLAY).toEqual({ 1: '£59', 2: '£149', 3: '£299' })
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/entitlements/index.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```ts
// lib/entitlements/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/entitlements/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entitlements/index.ts lib/entitlements/index.test.ts
git commit -m "feat(entitlements): single source of truth for tier config and copy"
```

---

### Task 2: `lib/supabase/entitlements.ts` — usage counting + guards

**Files:**
- Create: `lib/supabase/entitlements.ts`
- Test: `lib/supabase/entitlements.test.ts`

**Interfaces:**
- Consumes: `getSubscriptionForUser` (`lib/supabase/payments`); `ENTITLEMENTS`, `isTier`, `Tier` (`lib/entitlements`).
- Produces:
  - `EntitlementCheck { allowed, gated, tier: Tier|null, limit: number|null, used: number, reason?: 'NO_SUBSCRIPTION'|'LIMIT_REACHED' }`
  - `assertCanSendConnectionRequest(c, userId, role): Promise<EntitlementCheck>`
  - `assertCanCreateListing(c, userId, role): Promise<EntitlementCheck>`
  - `assertCanSendMessage(c, userId, role): Promise<EntitlementCheck>`
  - `EntitlementUsage { tier, analytics, requests:{limit,used}, listings:{limit,used}, messages:{limit,used} }`
  - `getEntitlementUsage(c, userId): Promise<EntitlementUsage | null>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/supabase/entitlements.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/supabase/entitlements.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```ts
// lib/supabase/entitlements.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { ENTITLEMENTS, isTier, type Tier } from '@/lib/entitlements'

type Role = Database['public']['Tables']['users']['Row']['role']
type Client = SupabaseClient<Database>

const ACTIVE_STATUSES = new Set(['active', 'trialing'])
type Capability = 'requests' | 'listings' | 'messages'

export interface EntitlementCheck {
  allowed: boolean
  gated: boolean // true only when the actor is a subscription-gated brand
  tier: Tier | null
  limit: number | null // null = unlimited
  used: number
  reason?: 'NO_SUBSCRIPTION' | 'LIMIT_REACHED'
}

const UNGATED: EntitlementCheck = { allowed: true, gated: false, tier: null, limit: null, used: 0 }

// cast drops the Database generic to avoid deep PostgREST inference (matches lib/supabase/* idiom)
async function countSince(c: Client, table: 'connection_requests' | 'messages', userId: string, sinceIso: string): Promise<number> {
  const { count, error } = await (c as SupabaseClient)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

async function countActiveListings(c: Client, brandProfileId: string): Promise<number> {
  const { count, error } = await (c as SupabaseClient)
    .from('job_listings')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandProfileId)
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

async function check(c: Client, userId: string, role: Role, capability: Capability): Promise<EntitlementCheck> {
  if (role !== 'brand') return UNGATED
  const sub = await getSubscriptionForUser(c, userId)
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) {
    return { allowed: false, gated: true, tier: null, limit: null, used: 0, reason: 'NO_SUBSCRIPTION' }
  }
  const tier: Tier = isTier(sub.tier) ? sub.tier : 1
  const limit = ENTITLEMENTS[tier][capability]
  if (limit === null) return { allowed: true, gated: true, tier, limit: null, used: 0 }
  const used =
    capability === 'requests'
      ? await countSince(c, 'connection_requests', userId, sub.current_period_start)
      : capability === 'messages'
        ? await countSince(c, 'messages', userId, sub.current_period_start)
        : await countActiveListings(c, sub.brand_id)
  return {
    allowed: used < limit,
    gated: true,
    tier,
    limit,
    used,
    ...(used < limit ? {} : { reason: 'LIMIT_REACHED' as const }),
  }
}

export const assertCanSendConnectionRequest = (c: Client, userId: string, role: Role) => check(c, userId, role, 'requests')
export const assertCanCreateListing = (c: Client, userId: string, role: Role) => check(c, userId, role, 'listings')
export const assertCanSendMessage = (c: Client, userId: string, role: Role) => check(c, userId, role, 'messages')

export interface EntitlementUsage {
  tier: Tier
  analytics: boolean
  requests: { limit: number | null; used: number }
  listings: { limit: number | null; used: number }
  messages: { limit: number | null; used: number }
}

export async function getEntitlementUsage(c: Client, userId: string): Promise<EntitlementUsage | null> {
  const sub = await getSubscriptionForUser(c, userId)
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) return null
  const tier: Tier = isTier(sub.tier) ? sub.tier : 1
  const e = ENTITLEMENTS[tier]
  const [requests, messages, listings] = await Promise.all([
    e.requests === null ? Promise.resolve(0) : countSince(c, 'connection_requests', userId, sub.current_period_start),
    e.messages === null ? Promise.resolve(0) : countSince(c, 'messages', userId, sub.current_period_start),
    e.listings === null ? Promise.resolve(0) : countActiveListings(c, sub.brand_id),
  ])
  return {
    tier,
    analytics: e.analytics,
    requests: { limit: e.requests, used: requests },
    listings: { limit: e.listings, used: listings },
    messages: { limit: e.messages, used: messages },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/supabase/entitlements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/entitlements.ts lib/supabase/entitlements.test.ts
git commit -m "feat(entitlements): billing-period usage counting and gated guards"
```

---

### Task 3: Enforce connection-request cap in the route

**Files:**
- Modify: `app/api/discovery/connections/route.ts` (insert guard after the rate-limit `consume` check, before body parse)
- Test: `app/api/discovery/connections/route.test.ts` (add cases)

**Interfaces:**
- Consumes: `assertCanSendConnectionRequest` (Task 2), `getUser` (`user.id`, `user.role`).

- [ ] **Step 1: Write the failing test** (append to the existing route test)

```ts
// app/api/discovery/connections/route.test.ts — add mock + cases
vi.mock('@/lib/supabase/entitlements', async (io) => {
  const actual = await io<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanSendConnectionRequest: vi.fn() }
})
import { assertCanSendConnectionRequest } from '@/lib/supabase/entitlements'

it('returns 402 when the brand has hit its request cap', async () => {
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'brand' } as never)
  vi.mocked(assertCanSendConnectionRequest).mockResolvedValue({
    allowed: false, gated: true, tier: 1, limit: 15, used: 15, reason: 'LIMIT_REACHED',
  })
  const res = await POST(makeRequest('POST', { recipient_id: 'u2', message: 'hi there friend' }))
  expect(res.status).toBe(402)
  expect((await res.json()).error.code).toBe('LIMIT_REACHED')
})

it('proceeds when under the cap', async () => {
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'brand' } as never)
  vi.mocked(assertCanSendConnectionRequest).mockResolvedValue({
    allowed: true, gated: true, tier: 1, limit: 15, used: 3,
  })
  // existing send mock resolves a row; assert we did NOT short-circuit at 402
  const res = await POST(makeRequest('POST', { recipient_id: 'u2', message: 'hi there friend' }))
  expect(res.status).not.toBe(402)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/api/discovery/connections/route.test.ts`
Expected: FAIL (guard not wired; 402 case returns 201/other).

- [ ] **Step 3: Add the guard to the route**

Insert immediately after the rate-limit block (`if (!limited.allowed) return tooManyRequests(...)`):

```ts
import { assertCanSendConnectionRequest } from '@/lib/supabase/entitlements'
// ...
const gate = await assertCanSendConnectionRequest(supabase, user.id, user.role)
if (!gate.allowed) {
  return NextResponse.json(
    {
      error: {
        code: gate.reason === 'NO_SUBSCRIPTION' ? 'SUBSCRIPTION_REQUIRED' : 'LIMIT_REACHED',
        message:
          gate.reason === 'NO_SUBSCRIPTION'
            ? 'An active subscription is required to send connection requests.'
            : `You have used all ${gate.limit} connection requests for this billing period. Upgrade your plan for more.`,
      },
      limit: gate.limit,
      used: gate.used,
      tier: gate.tier,
    },
    { status: 402 },
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- app/api/discovery/connections/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/discovery/connections/route.ts app/api/discovery/connections/route.test.ts
git commit -m "feat(entitlements): enforce connection-request cap (402)"
```

---

### Task 4: Enforce active-listing cap in the route

**Files:**
- Modify: `app/api/discovery/listings/route.ts` (insert guard after the existing `user.role !== 'brand'` check and after `brandProfile` is resolved)
- Test: `app/api/discovery/listings/route.test.ts` (add cases)

**Interfaces:**
- Consumes: `assertCanCreateListing` (Task 2).

- [ ] **Step 1: Write the failing test** (append)

```ts
vi.mock('@/lib/supabase/entitlements', async (io) => {
  const actual = await io<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanCreateListing: vi.fn() }
})
import { assertCanCreateListing } from '@/lib/supabase/entitlements'

it('returns 402 when the brand has hit its active-listing cap', async () => {
  vi.mocked(getUser).mockResolvedValue({ ...fakeUser, role: 'brand' } as never)
  vi.mocked(getOwnProfile).mockResolvedValue(fakeBrandProfile as never)
  vi.mocked(assertCanCreateListing).mockResolvedValue({
    allowed: false, gated: true, tier: 1, limit: 3, used: 3, reason: 'LIMIT_REACHED',
  })
  const res = await POST(makeRequest('POST', { title: 'Test', type: 'athlete_endorsement' }))
  expect(res.status).toBe(402)
  expect((await res.json()).error.code).toBe('LIMIT_REACHED')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/api/discovery/listings/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the guard**

Insert after the `brandProfile` null-check (before `readJsonBody`):

```ts
import { assertCanCreateListing } from '@/lib/supabase/entitlements'
// ...
const gate = await assertCanCreateListing(supabase, user.id, user.role)
if (!gate.allowed) {
  return NextResponse.json(
    {
      error: {
        code: gate.reason === 'NO_SUBSCRIPTION' ? 'SUBSCRIPTION_REQUIRED' : 'LIMIT_REACHED',
        message:
          gate.reason === 'NO_SUBSCRIPTION'
            ? 'An active subscription is required to create listings.'
            : `Your plan allows ${gate.limit} active listings. Pause or upgrade to add more.`,
      },
      limit: gate.limit,
      used: gate.used,
      tier: gate.tier,
    },
    { status: 402 },
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- app/api/discovery/listings/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/discovery/listings/route.ts app/api/discovery/listings/route.test.ts
git commit -m "feat(entitlements): enforce active-listing cap (402)"
```

---

### Task 5: Enforce Starter messaging cap in the route

**Files:**
- Modify: `app/api/messaging/matches/[matchId]/messages/route.ts` (insert guard after the rate-limit block, before body parse)
- Test: `app/api/messaging/matches/[matchId]/messages/route.test.ts` (add cases)

**Interfaces:**
- Consumes: `assertCanSendMessage` (Task 2). Dynamic route: second arg `{ params: Promise.resolve({ matchId: 'x' }) }`.

- [ ] **Step 1: Write the failing test** (append)

```ts
vi.mock('@/lib/supabase/entitlements', async (io) => {
  const actual = await io<typeof import('@/lib/supabase/entitlements')>()
  return { ...actual, assertCanSendMessage: vi.fn() }
})
import { assertCanSendMessage } from '@/lib/supabase/entitlements'

it('returns 402 when a Starter brand has hit its monthly message cap', async () => {
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'brand' } as never)
  vi.mocked(assertCanSendMessage).mockResolvedValue({
    allowed: false, gated: true, tier: 1, limit: 100, used: 100, reason: 'LIMIT_REACHED',
  })
  const res = await POST(
    new NextRequest(new URL('/api/messaging/matches/m1/messages', 'http://localhost'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'text', text_content: 'hello' }),
    }),
    { params: Promise.resolve({ matchId: 'm1' }) },
  )
  expect(res.status).toBe(402)
  expect((await res.json()).error.code).toBe('LIMIT_REACHED')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "app/api/messaging/matches/[matchId]/messages/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Add the guard**

Insert after the rate-limit block:

```ts
import { assertCanSendMessage } from '@/lib/supabase/entitlements'
// ...
const gate = await assertCanSendMessage(supabase, user.id, user.role)
if (!gate.allowed) {
  return NextResponse.json(
    {
      error: {
        code: gate.reason === 'NO_SUBSCRIPTION' ? 'SUBSCRIPTION_REQUIRED' : 'LIMIT_REACHED',
        message:
          gate.reason === 'NO_SUBSCRIPTION'
            ? 'An active subscription is required to send messages.'
            : `You have reached your plan's limit of ${gate.limit} messages this billing period. Upgrade for unlimited messaging.`,
      },
      limit: gate.limit,
      used: gate.used,
      tier: gate.tier,
    },
    { status: 402 },
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- "app/api/messaging/matches/[matchId]/messages/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/messaging/matches/[matchId]/messages/route.ts" "app/api/messaging/matches/[matchId]/messages/route.test.ts"
git commit -m "feat(entitlements): enforce Starter messaging cap (402)"
```

---

### Task 6: Rebuild pricing surfaces from the shared config

**Files:**
- Modify: `app/(public)/pricing/page.tsx` (replace `BRAND_TIERS` array [lines ~44-78] and the feature render with config-derived data)
- Modify: `components/brand/subscription-tiers.tsx` (replace `TIERS` [~30-34] and `FEATURES` [~42-49] with config-derived data; keep the checkout POST logic unchanged)
- Modify: `components/layout/footer.tsx` (add a Pricing link to `PRODUCT_LINKS` [~14-17])
- Verify: `components/landing/stage/stage-nav.tsx` already links `href="/pricing"` (no change unless missing)
- Test: `app/(public)/pricing/page.test.tsx` (new, render assertions)

**Interfaces:**
- Consumes: `TIER_NAMES`, `TIER_PRICE_DISPLAY`, `TIER_TAGLINE`, `TIERS`, `POPULAR_TIER`, `featureBullets`, `COMPARISON_ROWS` (Task 1). `ROUTES.pricing`, `ROUTES.auth.signUpAs` (`lib/routes.ts`).

- [ ] **Step 1: Write the failing test**

```tsx
// app/(public)/pricing/page.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PricingPage from './page'

describe('pricing page', () => {
  it('shows the new prices and names, and no matching claim', () => {
    render(<PricingPage />)
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('£59')).toBeInTheDocument()
    expect(screen.getByText('£149')).toBeInTheDocument()
    expect(screen.getByText('£299')).toBeInTheDocument()
    expect(screen.queryByText(/exact-match|3 of 5|maximum-reach/i)).not.toBeInTheDocument()
    // no stale prices
    expect(screen.queryByText('£249')).not.toBeInTheDocument()
    expect(screen.queryByText('£599')).not.toBeInTheDocument()
  })
})
```

Note: confirm `@testing-library/react` is available (`package.json`); if a `.tsx` component test already exists in the repo (e.g. `components/agent/deal-pipeline.test.tsx`), mirror its render setup. If RTL is not installed, replace this with a unit test that imports the page's tier data source and asserts on the config instead (do not add a new dependency).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- "app/(public)/pricing/page.test.tsx"`
Expected: FAIL (old prices/names).

- [ ] **Step 3: Rewrite the pricing page brand tiers**

Replace the `BRAND_TIERS` const and its render loop so each brand card derives from config:

```tsx
import { TIERS, TIER_NAMES, TIER_PRICE_DISPLAY, TIER_TAGLINE, POPULAR_TIER, featureBullets } from '@/lib/entitlements'
// ...
{TIERS.map((tier) => {
  const bullets = featureBullets(tier)
  const popular = tier === POPULAR_TIER
  return (
    <article key={tier} /* keep existing card classes; add popular styling when popular */>
      <h3>{TIER_NAMES[tier]}</h3>
      {popular ? <span>Most popular</span> : null}
      <p><span>{TIER_PRICE_DISPLAY[tier]}</span><span>/mo</span></p>
      <p>{TIER_TAGLINE[tier]}</p>
      <ul>
        {bullets.map((b) => (
          <li key={b}><Check aria-hidden /><span>{b}</span></li>
        ))}
      </ul>
      <Link href={ROUTES.auth.signUpAs('brand')} className={buttonVariants({ variant: popular ? 'default' : 'outline' })}>
        Start free trial
      </Link>
    </article>
  )
})}
```

Keep the existing "Free forever" section and `<Footer />` untouched. Preserve the existing Tailwind classes for the cards; only the data source and the removed matching bullets change.

- [ ] **Step 4: Rewrite the checkout component tiers**

In `components/brand/subscription-tiers.tsx`, derive `TIERS` display and the comparison table from config:

```tsx
import { TIERS, TIER_NAMES, TIER_PRICE_DISPLAY, TIER_TAGLINE, POPULAR_TIER, COMPARISON_ROWS } from '@/lib/entitlements'
```
- Replace the local `TIERS` array's name/price/tagline/popular fields with `TIER_NAMES[t]`, `TIER_PRICE_DISPLAY[t]`, `TIER_TAGLINE[t]`, `t === POPULAR_TIER`.
- Replace the `FEATURES` matrix with `COMPARISON_ROWS` (same `{ label, values }` shape the existing `ValueCell` renderer expects: string renders as text, boolean renders as tick/cross).
- Do NOT change `handleStartTrial` / the `/api/payments/subscriptions/checkout` POST. The `tier` sent to checkout stays the integer 1/2/3.

- [ ] **Step 5: Add the footer Pricing link**

In `components/layout/footer.tsx`, add to `PRODUCT_LINKS`:

```ts
{ label: 'Pricing', href: ROUTES.pricing },
```
(`ROUTES.pricing` = `/pricing`, already a real route, satisfying the footer's "href must resolve" rule.)

- [ ] **Step 6: Verify landing nav + run checks**

Confirm `components/landing/stage/stage-nav.tsx` still renders the `href="/pricing"` link. Then:

Run: `npm run test -- "app/(public)/pricing/page.test.tsx"` -> PASS
Run: `npm run type-check` -> clean

- [ ] **Step 7: Commit**

```bash
git add "app/(public)/pricing/page.tsx" components/brand/subscription-tiers.tsx components/layout/footer.tsx "app/(public)/pricing/page.test.tsx"
git commit -m "feat(pricing): render tiers from shared config; new prices/names; footer link; drop matching claim"
```

---

### Task 7: In-app usage meters (discover + listings)

**Files:**
- Create: `components/brand/usage-meter.tsx` (presentational: label, used, limit)
- Modify: `app/(brand)/brand/discover/page.tsx` (fetch `getEntitlementUsage`, pass requests usage; render meter)
- Modify: `app/(brand)/brand/listings/page.tsx` (render listings usage meter) — confirm this page path exists; if listings live under the dashboard, add the meter there instead
- Test: `components/brand/usage-meter.test.tsx`

**Interfaces:**
- Consumes: `getEntitlementUsage` (Task 2). Server pages fetch it and pass plain numbers to the client `UsageMeter`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/brand/usage-meter.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageMeter } from './usage-meter'

describe('UsageMeter', () => {
  it('shows used over limit', () => {
    render(<UsageMeter label="Connection requests" used={12} limit={15} />)
    expect(screen.getByText(/12 \/ 15/)).toBeInTheDocument()
  })
  it('shows unlimited when limit is null', () => {
    render(<UsageMeter label="Messaging" used={0} limit={null} />)
    expect(screen.getByText(/Unlimited/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/brand/usage-meter.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `UsageMeter`**

```tsx
// components/brand/usage-meter.tsx
interface Props { label: string; used: number; limit: number | null }
export function UsageMeter({ label, used, limit }: Props) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const atCap = limit !== null && used >= limit
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className={atCap ? 'font-medium text-destructive' : 'font-medium'}>
          {limit === null ? 'Unlimited' : `${used} / ${limit}`}
        </span>
      </div>
      {limit !== null ? (
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Wire the meter into the discover page (and listings)**

In `app/(brand)/brand/discover/page.tsx`, add to the existing `Promise.all` fetch: `getEntitlementUsage(supabase, user.id)`. When it is non-null, render `<UsageMeter label="Connection requests this period" used={usage.requests.used} limit={usage.requests.limit} />` near the top of the results. Do the same for listings usage on the listings surface. If `getEntitlementUsage` returns null (no active subscription), render the existing "subscription required" nudge instead.

- [ ] **Step 5: Run tests + type-check**

Run: `npm run test -- components/brand/usage-meter.test.tsx` -> PASS
Run: `npm run type-check` -> clean

- [ ] **Step 6: Commit**

```bash
git add components/brand/usage-meter.tsx components/brand/usage-meter.test.tsx "app/(brand)/brand/discover/page.tsx" "app/(brand)/brand/listings/page.tsx"
git commit -m "feat(entitlements): show live usage meters on brand discover and listings"
```

---

### Task 8: `lib/supabase/brand-analytics.ts` — analytics data

**Files:**
- Create: `lib/supabase/brand-analytics.ts`
- Test: `lib/supabase/brand-analytics.test.ts`

**Scope note:** Per-listing engagement is intentionally omitted (no listing↔request/match link exists in the schema). v1 = outreach funnel, acceptance/response rates, aggregate reach of connected athletes, a listings-count summary, and a daily time-series.

**Interfaces:**
- Produces:
  - `BrandAnalytics { periodStart, periodEnd, funnel: { requestsSent, accepted, declined, responded, messaged }, acceptanceRate, responseRate, connectedAthletes, reachAudience, listings: { active, total }, timeSeries: Array<{ date, requestsSent, accepted }> }`
  - `getBrandAnalytics(c, brandUserId, brandProfileId, periodStart, periodEnd): Promise<BrandAnalytics>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/supabase/brand-analytics.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/supabase/brand-analytics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/supabase/brand-analytics.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>
const AUDIENCE_KEYS = ['instagram_followers', 'tiktok_followers', 'youtube_subscribers', 'twitter_followers']

export function audienceOf(social: unknown): number {
  if (!social || typeof social !== 'object') return 0
  const rec = social as Record<string, unknown>
  let max = 0
  for (const k of AUDIENCE_KEYS) {
    const raw = rec[k]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return max
}

interface ReqRow { status: string; responded_at?: string | null; created_at?: string }

export function computeFunnel(rows: ReqRow[], messaged: number) {
  const requestsSent = rows.length
  const accepted = rows.filter((r) => r.status === 'accepted').length
  const declined = rows.filter((r) => r.status === 'declined').length
  const responded = rows.filter((r) => r.responded_at != null).length
  return {
    funnel: { requestsSent, accepted, declined, responded, messaged },
    acceptanceRate: requestsSent === 0 ? 0 : accepted / requestsSent,
    responseRate: requestsSent === 0 ? 0 : responded / requestsSent,
  }
}

export function buildTimeSeries(rows: ReqRow[]): Array<{ date: string; requestsSent: number; accepted: number }> {
  const byDay = new Map<string, { requestsSent: number; accepted: number }>()
  for (const r of rows) {
    const date = (r.created_at ?? '').slice(0, 10)
    if (!date) continue
    const cur = byDay.get(date) ?? { requestsSent: 0, accepted: 0 }
    cur.requestsSent += 1
    if (r.status === 'accepted') cur.accepted += 1
    byDay.set(date, cur)
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
}

export interface BrandAnalytics {
  periodStart: string
  periodEnd: string
  funnel: { requestsSent: number; accepted: number; declined: number; responded: number; messaged: number }
  acceptanceRate: number
  responseRate: number
  connectedAthletes: number
  reachAudience: number
  listings: { active: number; total: number }
  timeSeries: Array<{ date: string; requestsSent: number; accepted: number }>
}

export async function getBrandAnalytics(
  c: Client,
  brandUserId: string,
  brandProfileId: string,
  periodStart: string,
  periodEnd: string,
): Promise<BrandAnalytics> {
  const db = c as SupabaseClient // cast drops Database generic to avoid deep PostgREST inference

  // 1. Requests sent in-period (funnel + time-series)
  const { data: reqs, error: reqErr } = await db
    .from('connection_requests')
    .select('status, responded_at, created_at, recipient_id')
    .eq('sender_id', brandUserId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
  if (reqErr) throw reqErr
  const reqRows = (reqs ?? []) as Array<ReqRow & { recipient_id: string }>

  // 2. Distinct matches messaged in-period
  const { data: msgs, error: msgErr } = await db
    .from('messages')
    .select('match_id')
    .eq('sender_id', brandUserId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
  if (msgErr) throw msgErr
  const messaged = new Set((msgs ?? []).map((m: { match_id: string }) => m.match_id)).size

  // 3. Reach: all-time accepted connections -> athlete audience
  const { data: accepted, error: accErr } = await db
    .from('connection_requests')
    .select('recipient_id')
    .eq('sender_id', brandUserId)
    .eq('status', 'accepted')
  if (accErr) throw accErr
  const athleteUserIds = [...new Set((accepted ?? []).map((r: { recipient_id: string }) => r.recipient_id))]
  let reachAudience = 0
  if (athleteUserIds.length > 0) {
    const { data: profiles, error: profErr } = await db
      .from('athlete_profiles')
      .select('social_accounts')
      .in('user_id', athleteUserIds)
    if (profErr) throw profErr
    reachAudience = (profiles ?? []).reduce((sum: number, p: { social_accounts: unknown }) => sum + audienceOf(p.social_accounts), 0)
  }

  // 4. Listings summary
  const { count: totalListings } = await db.from('job_listings').select('id', { count: 'exact', head: true }).eq('brand_id', brandProfileId)
  const { count: activeListings } = await db.from('job_listings').select('id', { count: 'exact', head: true }).eq('brand_id', brandProfileId).eq('status', 'active')

  const { funnel, acceptanceRate, responseRate } = computeFunnel(reqRows, messaged)
  return {
    periodStart,
    periodEnd,
    funnel,
    acceptanceRate,
    responseRate,
    connectedAthletes: athleteUserIds.length,
    reachAudience,
    listings: { active: activeListings ?? 0, total: totalListings ?? 0 },
    timeSeries: buildTimeSeries(reqRows),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/supabase/brand-analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/brand-analytics.ts lib/supabase/brand-analytics.test.ts
git commit -m "feat(analytics): brand analytics data functions (funnel, reach, time-series)"
```

---

### Task 9: Enterprise analytics page + gate + charts + entry card

**Files:**
- Create: `app/(brand)/brand/analytics/page.tsx` (server component; create BEFORE adding the ROUTES entry)
- Create: `components/brand/analytics/analytics-dashboard.tsx` (client; renders tiles + charts)
- Create: `components/brand/analytics/funnel-bars.tsx`, `components/brand/analytics/line-chart.tsx` (hand-rolled SVG)
- Create: `components/brand/analytics/analytics-locked.tsx` (upsell state)
- Modify: `lib/routes.ts` (add `analytics: '/brand/analytics'` to the `brand` block, AFTER the page exists)
- Modify: `app/(brand)/brand/dashboard/page.tsx` (add an Analytics entry card linking to `ROUTES.brand.analytics`, showing a locked hint for non-Enterprise)
- Test: `components/brand/analytics/line-chart.test.tsx`

**Interfaces:**
- Consumes: `getBrandAnalytics` (Task 8), `getSubscriptionForUser` / `getBrandProfileIdForUser` (`lib/supabase/payments`), `getEntitlementUsage` (for the gate/analytics flag), `ENTITLEMENTS`/`isTier` (Task 1), `getUser`, `getOwnProfile`.

- [ ] **Step 1: Write the failing test (chart primitive)**

```tsx
// components/brand/analytics/line-chart.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LineChart } from './line-chart'

describe('LineChart', () => {
  it('renders a polyline point per data value', () => {
    const { container } = render(
      <LineChart data={[{ x: '2026-08-01', y: 2 }, { x: '2026-08-02', y: 5 }, { x: '2026-08-03', y: 1 }]} />,
    )
    const poly = container.querySelector('polyline')
    expect(poly).not.toBeNull()
    expect((poly?.getAttribute('points') ?? '').trim().split(/\s+/)).toHaveLength(3)
  })
  it('renders nothing breaking for empty data', () => {
    const { container } = render(<LineChart data={[]} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/brand/analytics/line-chart.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the SVG line chart**

```tsx
// components/brand/analytics/line-chart.tsx
interface Point { x: string; y: number }
export function LineChart({ data, height = 160 }: { data: Point[]; height?: number }) {
  const width = 480
  const pad = 24
  const maxY = Math.max(1, ...data.map((d) => d.y))
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0
  const points = data
    .map((d, i) => {
      const x = pad + i * stepX
      const y = height - pad - (d.y / maxY) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Trend over the billing period">
      {data.length > 0 ? <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-primary" /> : null}
    </svg>
  )
}
```

- [ ] **Step 4: Implement `funnel-bars.tsx`, `analytics-locked.tsx`, `analytics-dashboard.tsx`**

- `funnel-bars.tsx`: horizontal bars for `requestsSent -> accepted -> messaged`, each width proportional to `requestsSent`, with the count labelled. Pure SVG or divs with `style={{ width: pct }}`.
- `analytics-locked.tsx`: a card explaining analytics is an Enterprise feature, with a link to `ROUTES.brand.subscription` ("Upgrade to Enterprise").
- `analytics-dashboard.tsx` (client): accepts a `BrandAnalytics` prop; renders `StatStrip`-style tiles (connected athletes, reach audience, acceptance rate, response rate), the `FunnelBars`, and a `LineChart` of `timeSeries` requestsSent. Includes a "Download CSV" link to `/api/brand/analytics/export` (Task 10).

- [ ] **Step 5: Implement the page with the Enterprise gate**

```tsx
// app/(brand)/brand/analytics/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { ENTITLEMENTS, isTier } from '@/lib/entitlements'
import { AnalyticsDashboard } from '@/components/brand/analytics/analytics-dashboard'
import { AnalyticsLocked } from '@/components/brand/analytics/analytics-locked'

export const metadata = { robots: { index: false, follow: false } }

export default async function BrandAnalyticsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')
  if (user.role !== 'brand') redirect('/auth')

  // cast: getOwnProfile returns a role-union row; brand branch guaranteed by role check above
  const brandProfile = (await getOwnProfile(supabase, user.id, 'brand')) as { id: string } | null
  if (!brandProfile) redirect('/brand/onboarding')

  const sub = await getSubscriptionForUser(supabase, user.id)
  const tier = sub && isTier(sub.tier) ? sub.tier : null
  const unlocked = tier !== null && ENTITLEMENTS[tier].analytics && (sub?.status === 'active' || sub?.status === 'trialing')

  if (!unlocked || !sub) return <AnalyticsLocked />

  const analytics = await getBrandAnalytics(supabase, user.id, brandProfile.id, sub.current_period_start, sub.current_period_end)
  return <AnalyticsDashboard data={analytics} />
}
```

- [ ] **Step 6: Add the ROUTES entry and dashboard entry card**

- In `lib/routes.ts`, add to the `brand` block: `analytics: '/brand/analytics',`.
- In `app/(brand)/brand/dashboard/page.tsx`, add a card/link to `ROUTES.brand.analytics`. If the brand is not Enterprise, render it with a small "Enterprise" lock hint (still linking to the page, which shows the upsell). Use existing card styling.

- [ ] **Step 7: Run tests + checks**

Run: `npm run test -- components/brand/analytics/line-chart.test.tsx` -> PASS
Run: `npm run test -- lib/routes.test.ts` -> PASS (page exists, so the new route resolves)
Run: `npm run type-check` -> clean

- [ ] **Step 8: Commit**

```bash
git add "app/(brand)/brand/analytics/page.tsx" components/brand/analytics/ lib/routes.ts "app/(brand)/brand/dashboard/page.tsx"
git commit -m "feat(analytics): Enterprise-gated brand analytics dashboard with SVG charts"
```

---

### Task 10: CSV export route (Enterprise-gated)

**Files:**
- Create: `app/api/brand/analytics/export/route.ts` (GET, returns `text/csv`)
- Test: `app/api/brand/analytics/export/route.test.ts`

**Interfaces:**
- Consumes: `getUser`, `getSubscriptionForUser`, `getBrandProfileIdForUser`, `getBrandAnalytics`, `ENTITLEMENTS`/`isTier`.
- Produces: a CSV download; non-Enterprise -> 403.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/brand/analytics/export/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/auth', async (io) => ({ ...(await io<typeof import('@/lib/supabase/auth')>()), getUser: vi.fn() }))
vi.mock('@/lib/supabase/payments', async (io) => ({ ...(await io<typeof import('@/lib/supabase/payments')>()), getSubscriptionForUser: vi.fn(), getBrandProfileIdForUser: vi.fn() }))
vi.mock('@/lib/supabase/brand-analytics', async (io) => ({ ...(await io<typeof import('@/lib/supabase/brand-analytics')>()), getBrandAnalytics: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, getBrandProfileIdForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { GET } from './route'

const req = () => new NextRequest(new URL('/api/brand/analytics/export', 'http://localhost'))

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue({} as never)
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', role: 'brand' } as never)
  vi.mocked(getBrandProfileIdForUser).mockResolvedValue('bp1' as never)
})

it('403 for a non-Enterprise brand', async () => {
  vi.mocked(getSubscriptionForUser).mockResolvedValue({ tier: 1, status: 'active', current_period_start: 's', current_period_end: 'e', brand_id: 'bp1' } as never)
  const res = await GET(req())
  expect(res.status).toBe(403)
})

it('returns text/csv for an Enterprise brand', async () => {
  vi.mocked(getSubscriptionForUser).mockResolvedValue({ tier: 3, status: 'active', current_period_start: 's', current_period_end: 'e', brand_id: 'bp1' } as never)
  vi.mocked(getBrandAnalytics).mockResolvedValue({
    periodStart: 's', periodEnd: 'e',
    funnel: { requestsSent: 4, accepted: 2, declined: 1, responded: 3, messaged: 2 },
    acceptanceRate: 0.5, responseRate: 0.75, connectedAthletes: 2, reachAudience: 6000,
    listings: { active: 1, total: 2 },
    timeSeries: [{ date: '2026-08-01', requestsSent: 2, accepted: 1 }],
  } as never)
  const res = await GET(req())
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/csv')
  expect(await res.text()).toContain('date,requestsSent,accepted')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/api/brand/analytics/export/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
// app/api/brand/analytics/export/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser, getBrandProfileIdForUser } from '@/lib/supabase/payments'
import { getBrandAnalytics } from '@/lib/supabase/brand-analytics'
import { ENTITLEMENTS, isTier } from '@/lib/entitlements'

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Brand access required' } }, { status: 403 })
  }
  const sub = await getSubscriptionForUser(supabase, user.id)
  const tier = sub && isTier(sub.tier) ? sub.tier : null
  const unlocked = tier !== null && ENTITLEMENTS[tier].analytics && (sub?.status === 'active' || sub?.status === 'trialing')
  if (!unlocked || !sub) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Analytics export is an Enterprise feature' } }, { status: 403 })
  }
  const brandProfileId = await getBrandProfileIdForUser(supabase, user.id)
  if (!brandProfileId) {
    return NextResponse.json({ error: { code: 'BRAND_PROFILE_NOT_FOUND', message: 'Brand profile not found' } }, { status: 404 })
  }
  const a = await getBrandAnalytics(supabase, user.id, brandProfileId, sub.current_period_start, sub.current_period_end)

  const lines: string[] = []
  lines.push('metric,value')
  lines.push(`requestsSent,${a.funnel.requestsSent}`)
  lines.push(`accepted,${a.funnel.accepted}`)
  lines.push(`declined,${a.funnel.declined}`)
  lines.push(`responded,${a.funnel.responded}`)
  lines.push(`messaged,${a.funnel.messaged}`)
  lines.push(`acceptanceRate,${a.acceptanceRate.toFixed(4)}`)
  lines.push(`responseRate,${a.responseRate.toFixed(4)}`)
  lines.push(`connectedAthletes,${a.connectedAthletes}`)
  lines.push(`reachAudience,${a.reachAudience}`)
  lines.push(`activeListings,${a.listings.active}`)
  lines.push(`totalListings,${a.listings.total}`)
  lines.push('')
  lines.push('date,requestsSent,accepted')
  for (const p of a.timeSeries) lines.push([csvField(p.date), p.requestsSent, p.accepted].join(','))

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="podium-analytics.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- app/api/brand/analytics/export/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the export route is session-authenticated (not in `PUBLIC_PATHS`)**

It reads the user session, so it must go through middleware auth like other brand API routes. Do NOT add it to `PUBLIC_PATHS`.

- [ ] **Step 6: Commit**

```bash
git add app/api/brand/analytics/export/route.ts app/api/brand/analytics/export/route.test.ts
git commit -m "feat(analytics): Enterprise-gated CSV export route"
```

---

### Task 11: Stripe test-mode prices + env wiring + live checklist + CLAUDE.md fix

**Files:**
- Create: `scripts/stripe/create-test-prices.mjs` (one-time; refuses non-test keys)
- Create: `docs/stripe-live-price-checklist.md` (Nicholas's manual live steps)
- Modify: `.env.local` (new `STRIPE_PRICE_TIER_1/2/3` test price IDs) — local only, gitignored
- Modify: `CLAUDE.md` (correct the stale "£99/£199/£399" note)

**Interfaces:**
- Consumes: `STRIPE_SECRET_KEY` (test) from `.env.local`. The webhook's `tierOf` reads `price.metadata.tier`, so each new price MUST carry `metadata.tier`.

- [ ] **Step 1: Write the price-creation script**

```js
// scripts/stripe/create-test-prices.mjs
// One-time: creates test-mode GBP monthly prices for the three tiers, each with metadata.tier.
// Run: node --env-file=.env.local scripts/stripe/create-test-prices.mjs
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key || !key.startsWith('sk_test_')) {
  console.error('Refusing: STRIPE_SECRET_KEY must be a TEST key (sk_test_...). No live-mode objects.')
  process.exit(1)
}
const stripe = new Stripe(key)
const product = await stripe.products.create({ name: 'Podium Subscription' })
const defs = [
  { tier: '1', name: 'Starter', amount: 5900 },
  { tier: '2', name: 'Growth', amount: 14900 },
  { tier: '3', name: 'Enterprise', amount: 29900 },
]
for (const d of defs) {
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'gbp',
    unit_amount: d.amount,
    recurring: { interval: 'month' },
    nickname: `Podium ${d.name} (GBP ${d.amount / 100}/mo)`,
    metadata: { tier: d.tier },
  })
  console.log(`STRIPE_PRICE_TIER_${d.tier}=${price.id}`)
}
```

- [ ] **Step 2: Run the script and capture the price IDs**

Run: `node --env-file=.env.local scripts/stripe/create-test-prices.mjs`
Expected: three `STRIPE_PRICE_TIER_n=price_...` lines. (If `--env-file` is unsupported by the installed Node, load `.env.local` via `dotenv` instead, or export the vars first.)

- [ ] **Step 3: Update `.env.local` and Vercel Preview env**

- Paste the three new IDs over the existing `STRIPE_PRICE_TIER_1/2/3` in `.env.local`.
- Update Vercel Preview (staging) env: `vercel env rm STRIPE_PRICE_TIER_1 preview` then `vercel env add STRIPE_PRICE_TIER_1 preview` (paste the new id); repeat for 2 and 3. Do NOT touch Production.

- [ ] **Step 4: Write the live checklist for Nicholas**

```md
<!-- docs/stripe-live-price-checklist.md -->
# Going live with the new prices (manual, Nicholas only)

Agents never create live-mode Stripe objects or change Production env vars. When ready:

1. In the Stripe Dashboard (LIVE mode), create three recurring GBP monthly prices under the Podium product:
   - Starter: £59.00 / month, metadata `tier = 1`
   - Growth: £149.00 / month, metadata `tier = 2`
   - Enterprise: £299.00 / month, metadata `tier = 3`
   The `tier` metadata is REQUIRED: the webhook reads `price.metadata.tier` to assign the plan.
2. Copy each live price id (`price_...`).
3. In Vercel > Project podium > Settings > Environment Variables > Production, set:
   - `STRIPE_PRICE_TIER_1` = live Starter price id
   - `STRIPE_PRICE_TIER_2` = live Growth price id
   - `STRIPE_PRICE_TIER_3` = live Enterprise price id
4. Redeploy production. Existing subscribers keep their current price until they change plans.
```

- [ ] **Step 5: Fix the stale CLAUDE.md note**

In `CLAUDE.md`, replace the "Test-mode tier prices are placeholders (£99/£199/£399)" sentence with the true current test prices: "Test-mode tier prices are £59/£149/£299 (Starter/Growth/Enterprise), each carrying `metadata.tier`. Live-mode prices pending per `docs/stripe-live-price-checklist.md`."

- [ ] **Step 6: Verify a fresh checkout uses the new price on staging**

Push the branch, open the staging preview, start a brand trial for each tier, and confirm the Stripe Checkout shows £59/£149/£299 and the resulting `subscriptions.tier` is correct (webhook reads `metadata.tier`).

- [ ] **Step 7: Commit** (script, checklist, CLAUDE.md only — never `.env.local`)

```bash
git add scripts/stripe/create-test-prices.mjs docs/stripe-live-price-checklist.md CLAUDE.md
git commit -m "chore(stripe): test-mode price creation script, live checklist, correct CLAUDE.md prices"
```

---

## Final verification (all tasks done)

- [ ] `npm run check` (test + type-check + lint) is green.
- [ ] On the staging URL, verified end to end:
  - Pricing page and in-app checkout show Starter/Growth/Enterprise at £59/£149/£299, no matching claim, footer + header Pricing links work.
  - A Starter brand is blocked (402) at 15 requests / 3 active listings / 100 messages; a Growth brand at 60 requests / 10 listings, unlimited messaging; an Enterprise brand is unlimited.
  - A brand with no active subscription is blocked from all three gated actions with a subscribe prompt.
  - The analytics dashboard shows for Enterprise and shows the locked upsell for Starter/Growth; CSV export downloads for Enterprise and 403s otherwise.
  - Usage meters show correct used/limit on discover and listings.
- [ ] Ping Nicholas: (a) matching bullets were dropped from copy vs the coworker's spec; (b) per-listing analytics omitted (no schema link) — optional future `listing_id` follow-up; (c) live Stripe prices await his manual checklist.

## Out of scope / future follow-ups

- Tier-aware matching (dropped by decision).
- Attributing connection requests to listings (needs a `connection_requests.listing_id` column; forward-only, cannot backfill) to enable per-listing analytics later.
- Live-mode Stripe prices and Production env changes (Nicholas's manual step).
- Self-serve plan changes (still via support email).
