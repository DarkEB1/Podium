# Pricing tiers + real entitlement enforcement

Date: 2026-08-14
Branch: `feat/pricing-tiers-entitlements` (off `staging`)
Status: approved design, ready for implementation plan

## Problem

The coworker wants three things: update the price tiers in-app and on Stripe, add a
way to view the pricing page from the landing page, and make sure the gating the
pricing advertises is actually enforced (no false advertising: people get what they
pay for).

Investigation found that today the tiers are entirely cosmetic. The `tier` integer
(1/2/3) is stored on the `subscriptions` row but read in only three non-gating places
(an upsell banner, the plan-name display, and admin stats). Every advertised limit
(connection requests per month, active listings, matching breadth, messaging, the
Enterprise analytics dashboard) has zero enforcement, and the analytics dashboard does
not exist at all. Prices also drift three ways: code shows £99/£249/£599, CLAUDE.md
claims £99/£199/£399, and the coworker now wants £59/£149/£299.

A `/pricing` page already exists (`app/(public)/pricing/page.tsx`) and the landing
header already links to it; the footer does not.

## Final tier definitions

| | Starter | Growth (most popular) | Enterprise |
|---|---|---|---|
| Price | £59/mo | £149/mo | £299/mo |
| Connection requests / period | 15 | 60 | Unlimited |
| Active listings | 3 | 10 | Unlimited |
| Messages / period | 100 | Unlimited | Unlimited |
| Analytics dashboard | No | No | Yes |
| Priority support | No | Yes (display only) | Yes (display only) |
| Dedicated account manager | No | No | Yes (display only) |

Decisions taken during brainstorming:
- Matching breadth ("exact-match / 3-of-5 / 1-of-5") is **dropped**, not built. The
  coworker's written spec listed these as differentiators; live copy will diverge from
  his text. Search/filters becomes a shared, non-tiered line. **Relay to coworker.**
- Starter messaging is a hard **100 messages per billing period** cap. Growth and
  Enterprise are unlimited.
- The Enterprise analytics dashboard is **built in this pass** (net-new), including
  time-series charts and CSV export.
- Priority support and dedicated account manager stay honest **display-only** copy;
  there is a single support mailbox, so no code routing is implied.

## Architecture

### 1. Single source of truth (`lib/entitlements/index.ts`, pure, no DB)

```ts
export type Tier = 1 | 2 | 3
export const TIER_NAMES: Record<Tier, string> = { 1: 'Starter', 2: 'Growth', 3: 'Enterprise' }
export const TIER_PRICE_DISPLAY: Record<Tier, string> = { 1: '£59', 2: '£149', 3: '£299' }
export interface Entitlement {
  requests: number | null   // null = unlimited
  listings: number | null
  messages: number | null
  analytics: boolean
  prioritySupport: boolean
  dedicatedManager: boolean
}
export const ENTITLEMENTS: Record<Tier, Entitlement> = {
  1: { requests: 15,   listings: 3,    messages: 100,  analytics: false, prioritySupport: false, dedicatedManager: false },
  2: { requests: 60,   listings: 10,   messages: null, analytics: false, prioritySupport: true,  dedicatedManager: false },
  3: { requests: null, listings: null, messages: null, analytics: true,  prioritySupport: true,  dedicatedManager: true  },
}
```

The pricing page, checkout component, admin, and enforcement all import this module.
The hand-mirrored feature arrays in `app/(public)/pricing/page.tsx` and
`components/brand/subscription-tiers.tsx` are removed in favour of it.

### 2. Enforcement layer (`lib/supabase/entitlements.ts`)

DB counts must live under `lib/supabase/` per project rules. Exposes:
- `getEntitlementUsage(userId)` -> `{ tier, requests: {limit, used}, listings: {limit, used}, messages: {limit, used}, analytics }`
- `assertCanSendConnectionRequest(userId)` -> `{ allowed, limit, used, tier }`
- `assertCanCreateListing(userId)` -> `{ allowed, limit, used, tier }`
- `assertCanSendMessage(userId)` -> `{ allowed, limit, used, tier }`

Each resolves the brand's subscription (`getSubscriptionForUser`), maps `tier` ->
`ENTITLEMENTS`, counts current usage, and compares. `null` limit short-circuits to
allowed (unlimited).

**Counting window = the billing period** (`current_period_start` -> now), already
stored on the `subscriptions` row. This means **no new columns and no reset cron**:
- Requests: `connection_requests` rows created by the brand since `current_period_start`.
- Messages: messages sent by the brand's users since `current_period_start`.
- Listings: current active `listings` count (point-in-time, not windowed).

Planning must confirm the exact columns (`created_at`, sender/brand FK, listing status
value for "active") on `connection_requests`, `messages`, and `listings`.

### 3. Route enforcement (HTTP 402 when blocked)

Guard called before the existing lib call in exactly three handlers; on block returns
402 with `{ error, limit, used, tier }`:
- `app/api/discovery/connections/route.ts`
- `app/api/discovery/listings/route.ts`
- `app/api/messaging/matches/[matchId]/messages/route.ts`

**No-subscription behavior (approved):** a brand with no active/trialing subscription
has no entitlement; gated actions are blocked with a subscribe prompt. This tightens
current behavior (listing creation does not check for a subscription today).

### 4. UI

- Discovery / listings / messaging surfaces show live usage ("12 / 15 requests this
  period") and swap the action for an upgrade CTA when the cap is hit. No silent
  failures.
- Pricing page + `subscription-tiers.tsx` rebuilt from the shared config: new prices,
  Starter/Growth/Enterprise names, matching-breadth bullets removed.
- Footer gets a Pricing link; landing header link already exists (confirm prominence).
- Customer-facing "Tier 1/2/3" strings replaced by the real names everywhere.

### 5. Enterprise analytics dashboard (net-new, gated)

- Route: `app/(brand)/brand/analytics/page.tsx`. Data: `lib/supabase/brand-analytics.ts`.
- Gated on `ENTITLEMENTS[tier].analytics`; non-Enterprise brands see a locked/upsell
  state, not data.
- v1 contents:
  - Outreach funnel: requests sent -> accepted -> messaged, with acceptance and
    response rates.
  - Per-listing performance: match and response counts per listing.
  - Aggregate reach: summed audience of connected athletes.
  - Time-series charts across the billing period.
  - CSV export of the underlying rows.
- Added to the brand nav (locked state for non-Enterprise).

### 6. Stripe (test-mode now; live gated to Nicholas)

- Create three new recurring GBP prices £59/£149/£299 on the **test-mode** Podium
  account (`acct_1U00dtRuiS086Bui`), each with `metadata.tier` = 1/2/3 (the webhook's
  `tierOf` reverse lookup reads `price.metadata.tier`).
- Point `STRIPE_PRICE_TIER_1/2/3` at the new prices in `.env.local` and Vercel
  **Preview** (staging) env. Existing subs keep their old price; new checkouts use the
  new ones.
- **Boundary:** no live-mode Stripe objects and no Production env changes by the agent.
  Deliver Nicholas a copy-paste checklist to create the live £59/£149/£299 prices (with
  `tier` metadata) and flip the production env vars when ready.

## Testing

- Unit: `lib/entitlements` config invariants; guard logic with mocked counts (under /
  at / over limit, unlimited tier, no-subscription).
- Integration: the three gated routes (allowed under cap, blocked at cap with 402,
  unlimited for higher tiers, blocked with no subscription).
- Analytics: data-function correctness and the Enterprise gate (non-Enterprise sees
  locked state).
- `npm run check` green and verified on the staging URL before anything approaches
  `main`. No DB migration expected.

## Out of scope

- Tier-aware matching (dropped by decision).
- Live-mode Stripe prices and Production env changes (Nicholas's manual step).
- Seat management (existing `seats_total`/`seats_used`, unchanged).
- Self-serve plan changes (still handled by emailing support).
