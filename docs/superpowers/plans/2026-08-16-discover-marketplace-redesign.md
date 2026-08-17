# Discover Marketplace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the athlete Discover feed (`/athlete/discover`) into an engaging, browsable "Live Board" experience: a made-for-you rail feed with explainable match scores, real urgency signals, and a tactile swipe deck as the star.

**Architecture:** The server component computes a match score plus reasons per listing (reusing `lib/matching/score.ts`) and groups listings into rails with a pure `buildRails()` helper, then hands scored listings and rails to a client feed. The feed renders rails by default and a filtered flat grid when a search or filter is active (reusing the existing `useListingFilters` hook, extended with a pay-type facet). Swipe mode reuses the existing Framer-Motion `SwipeDeck`, wrapped with a progress bar, a save flourish, and an end-of-deck payoff. The visual system is the approved "Live Board" mockup: scoreboard-numeral scores, mono metadata, deterministic branded tiles, glossy-plastic deck cards.

**Tech Stack:** Next.js 15 App Router, TypeScript strict (no `any`), Tailwind 4 with the locked Podium token system, `motion/react` (Framer Motion), Vitest + Testing Library, existing Supabase discovery lib.

**Spec / design source of truth:** the approved mockup `scratchpad/mockups/direction-a-live-board.html` (Direction A, Live Board), with the swipe deck built in the glossy-plastic material from `direction-b-editorial.html` and the stacked-card deck entry from `direction-c-kinetic.html`. Brainstorm scope: Tier A (match score + why, made-for-you rails, swipe-deck payoff, real urgency badges) plus cheap Tier B (brand-description card back, pay-type filter). No schema migrations. Deferred: campaign-level saves/compare, applied/spots-left counts, streaks, saved-search alerts.

**Score presentation (DECIDED):** the black scoreboard numeral was rejected as too heavy for the light UI. The match score is a **fit ring, "solid sweep"**: a single brand-blue (`--primary`) circular arc on a grey track (`--track`/border), rounded cap, the number centered in `font-mono` tabular. It **animates a speedometer sweep from empty to the value on load** (CSS transition on `stroke-dashoffset`, ~1000ms ease-out `cubic-bezier(.16,1,.3,1)`), gated behind `prefers-reduced-motion` (snap, no sweep). Built with `pathLength="100"` so `stroke-dashoffset` is simply `100 - score`. All colours from theme tokens so it holds in light and dark. Reference: `scratchpad/mockups/score-ring.html` flavor A1. Use this one mark everywhere (feed card, card back, swipe overlay), sized up on the card back. Update Task 6 (`MatchScore`) to build this ring, not the scoreboard.

**Scoring engine is INTERIM.** `lib/matching/score.ts` (the 5-signal weighted 0-100 model) is what we ship now, but it will eventually be replaced by **MeritRank**. Keep the score consumed through a single seam (`decorateWithMatch` in `lib/discovery/match.ts`) so swapping the underlying algorithm later touches one place, not every component. Add a short code comment to that effect in `match.ts`.

## Global Constraints

- **No em dashes** anywhere: code comments, UI copy, commit messages. Use commas, colons, parentheses, or restructure. Avoid AI tells (no "not just X but Y" cadence, no filler, no over-hedging). Sentence case for UI copy.
- **Locked design tokens only.** Palette: `--background #FAFBFB`, `--foreground/ink #17181A`, `--card #FFFFFF`, `--primary #2742F0`, `--muted-foreground #4A4B4E`, `--border #E4E6E5`, `--lime #C1EC2F`, `--lime-tint-2 #E9F5C4`, `--success #2F6446`, `--warning #835A10`, `--radius 0.875rem`. Lime is NEVER a text colour (use it as fill/underline with ink on top). Type: DM Sans everywhere, Geist Mono (`font-mono`) for numeric/metadata readouts. Three-size scale (`text-large`/`text-medium`/`text-small`) plus `text-display`; no raw `text-2xl..7xl`.
- **No `any`.** `as Type` requires a one-line comment. DB types come from `types/database.ts`.
- **Layer map:** no Supabase calls outside `lib/supabase/`; components are presentational; `"use client"` only for interactivity. Data fetching stays in the server component.
- **No `<Button asChild>`** (base-ui, not Radix). Use `<Link className={buttonVariants(...)}>`.
- **Accessibility floor:** visible keyboard focus, `prefers-reduced-motion` respected for every animation, swipe has button + arrow-key parity (already true in `SwipeCard`).
- **Green gate:** `npm run check` (type-check + lint + test) must pass at the end of every task before commit.
- **Deck is shared:** `components/ui/swipe-card.tsx` is used by athlete AND team discover. All additions to it must be opt-in and backward compatible.

---

## File Structure

**Pure logic (new, fully unit-tested):**
- `lib/discovery/match.ts` — `decorateWithMatch(listings, athlete)` → `ScoredListing[]`; exports the `ScoredListing` type.
- `lib/discovery/urgency.ts` — `getUrgency(listing, now)` → urgency descriptor for a card.
- `lib/discovery/rails.ts` — `buildRails(scored, opts)` → ordered rails for the feed.

**Data (modify, no schema change):**
- `lib/supabase/discovery.ts` — project `brand_profiles.description` as `brand_description` on `ListingSummary` (both mappers).
- `components/discovery/listings-filter.tsx` — add a `payType` facet to `useListingFilters` + `ListingsToolbar`.

**Client UI (new discover-specific components):**
- `components/discovery/match-score.tsx` — scoreboard-numeral score badge.
- `components/discovery/opportunity-card.tsx` — the Live Board card (replaces `listing-card.tsx` on this surface).
- `components/discovery/opportunity-detail.tsx` — the card-back dialog (brand story + reasons + terms + Save/Send request; reuses the connection composer).
- `components/discovery/opportunity-rail.tsx` — one horizontal rail.
- `components/discovery/discover-deck.tsx` — swipe mode wrapper: progress bar, save flourish, end-of-deck payoff, glossy deck cards.
- `components/discovery/discover-feed.tsx` — client orchestrator (mode toggle + filter bar + rails/grid/deck). Replaces `listings-browser.tsx` as the page's child.

**Deck primitive (modify, opt-in):**
- `components/ui/swipe-card.tsx` — add opt-in `glossy?: boolean` and `overlay?: React.ReactNode` (top-left figure overlay) props.

**Server (modify):**
- `app/(athlete)/athlete/discover/page.tsx` — decorate with match, build rails, render `DiscoverFeed`.

**Removed after the switch (dead once the page points at `DiscoverFeed`):**
- `components/discovery/listings-browser.tsx`, `listings-grid.tsx`, `listing-card.tsx` and their tests. Delete in the final task, not before, so the tree stays green.

**Shared type:**
```ts
// lib/discovery/match.ts
export type ScoredListing = ListingSummary & {
  matchScore: number      // 0..100 from scoreAthleteForListing
  matchReasons: string[]  // human-readable, e.g. ["Sport matches", "Available now"]
}
```

---

## Task 1: Project brand description for the card back

**Files:**
- Modify: `lib/supabase/discovery.ts` (both `brand_profiles` embeds + both mappers + `ListingSummary` type)
- Test: `lib/supabase/discovery.test.ts`

**Interfaces:**
- Produces: `ListingSummary.brand_description: string | null`

- [ ] **Step 1: Write the failing test** — add to `discovery.test.ts`, asserting `getActiveListingsPage` maps the embedded `brand_profiles.description` onto `brand_description`. Follow the existing mock/embed pattern already used for `brand_logo_url` in this file (mirror that test exactly, substituting `description`).

- [ ] **Step 2: Run it and confirm it fails**
Run: `npm run test -- discovery.test.ts`
Expected: FAIL (`brand_description` undefined).

- [ ] **Step 3: Implement.** In both selects, add `description` to the embed: `brand_profiles!inner(user_id, company_name, trading_name, logo_url, cover_image_url, description)`. Add `description: string | null` to the `EmbeddedBrand`/`Embedded` brand types. In both mappers add `brand_description: brand?.description ?? null`. Add `brand_description: string | null` to the `ListingSummary` type (after `brand_cover_url`).

- [ ] **Step 4: Run tests** — `npm run test -- discovery.test.ts` PASS; then `npm run type-check` clean.

- [ ] **Step 5: Commit** — `feat(discovery): project brand description for the card back`

---

## Task 2: Match decoration helper

**Files:**
- Create: `lib/discovery/match.ts`
- Test: `lib/discovery/match.test.ts`

**Interfaces:**
- Consumes: `scoreAthleteForListing` from `lib/matching/score.ts`, `ListingSummary` from `lib/supabase/discovery.ts`, the `athlete_profiles` Row type.
- Produces: `type ScoredListing`, `function decorateWithMatch(listings: ListingSummary[], athlete: MatchAthlete | null): ScoredListing[]`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest'
import { decorateWithMatch } from './match'

const athlete = { primary_sport: 'Surfing', level: 'pro', availability_status: 'available_now' }
const base = { id: '1', title: 'X', description: null, type: 't', status: 'active', sport_required: 'Surfing', level_required: 'pro', location: null, is_remote: true, pay_type: 'flat_fee', pay_amount: 100, pay_currency: 'GBP', contract_duration_months: null, application_deadline: null, created_at: '2026-08-10T00:00:00Z', brand_user_id: 'b', brand_name: 'B', brand_logo_url: null, brand_cover_url: null, brand_description: null }

it('attaches a 0..100 score and reasons from the matcher', () => {
  const [scored] = decorateWithMatch([base as never], athlete as never)
  expect(scored.matchScore).toBeGreaterThan(0)
  expect(scored.matchScore).toBeLessThanOrEqual(100)
  expect(scored.matchReasons).toContain('Sport matches')
})

it('with no athlete, score is 0 and reasons empty (never throws)', () => {
  const [scored] = decorateWithMatch([base as never], null)
  expect(scored.matchScore).toBe(0)
  expect(scored.matchReasons).toEqual([])
})
```

- [ ] **Step 2: Run it and confirm it fails** — `npm run test -- match.test.ts` FAIL (module missing).

- [ ] **Step 3: Implement**
```ts
import { scoreAthleteForListing, type MatchAthlete } from '@/lib/matching/score'
import type { ListingSummary } from '@/lib/supabase/discovery'

export type ScoredListing = ListingSummary & {
  matchScore: number
  matchReasons: string[]
}

export function decorateWithMatch(
  listings: ListingSummary[],
  athlete: MatchAthlete | null
): ScoredListing[] {
  return listings.map((listing) => {
    if (!athlete) return { ...listing, matchScore: 0, matchReasons: [] }
    const { score, reasons } = scoreAthleteForListing(athlete, listing)
    return { ...listing, matchScore: score, matchReasons: reasons }
  })
}
```

- [ ] **Step 4: Run tests** PASS; `npm run type-check` clean.

- [ ] **Step 5: Commit** — `feat(discovery): match-score decoration helper`

---

## Task 3: Urgency descriptor

**Files:**
- Create: `lib/discovery/urgency.ts`
- Test: `lib/discovery/urgency.test.ts`

**Interfaces:**
- Consumes: `ListingSummary` (`application_deadline`, `created_at`).
- Produces: `type Urgency = { kind: 'closing'; days: number; label: string } | { kind: 'new'; label: string } | null` and `function getUrgency(listing: Pick<ListingSummary,'application_deadline'|'created_at'>, now?: Date): Urgency`.

Rules: "closing" wins over "new". Closing = deadline set and within 7 days inclusive of today (days = whole days until deadline, floor at 0, label `Closes in Nd` or `Closes today` when 0). New = created within the last 7 days. Otherwise null.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest'
import { getUrgency } from './urgency'

const now = new Date('2026-08-16T12:00:00Z')

it('flags a deadline within 7 days as closing', () => {
  const u = getUrgency({ application_deadline: '2026-08-19T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'closing', days: 3, label: 'Closes in 3d' })
})
it('labels a same-day deadline "Closes today"', () => {
  const u = getUrgency({ application_deadline: '2026-08-16T20:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'closing', days: 0, label: 'Closes today' })
})
it('flags a listing created within 7 days as new', () => {
  const u = getUrgency({ application_deadline: null, created_at: '2026-08-12T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'new', label: 'New' })
})
it('returns null for an old listing with a far deadline', () => {
  expect(getUrgency({ application_deadline: '2026-12-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)).toBeNull()
})
it('closing takes priority over new', () => {
  const u = getUrgency({ application_deadline: '2026-08-18T00:00:00Z', created_at: '2026-08-15T00:00:00Z' }, now)
  expect(u?.kind).toBe('closing')
})
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement**
```ts
import type { ListingSummary } from '@/lib/supabase/discovery'

export type Urgency =
  | { kind: 'closing'; days: number; label: string }
  | { kind: 'new'; label: string }
  | null

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7

export function getUrgency(
  listing: Pick<ListingSummary, 'application_deadline' | 'created_at'>,
  now: Date = new Date()
): Urgency {
  if (listing.application_deadline) {
    const deadline = Date.parse(listing.application_deadline)
    if (!Number.isNaN(deadline)) {
      const days = Math.max(0, Math.floor((deadline - now.getTime()) / DAY_MS))
      if (days <= WINDOW_DAYS) {
        return { kind: 'closing', days, label: days === 0 ? 'Closes today' : `Closes in ${days}d` }
      }
    }
  }
  const created = Date.parse(listing.created_at)
  if (!Number.isNaN(created) && now.getTime() - created <= WINDOW_DAYS * DAY_MS) {
    return { kind: 'new', label: 'New' }
  }
  return null
}
```

- [ ] **Step 4: Run tests** PASS; type-check clean.

- [ ] **Step 5: Commit** — `feat(discovery): urgency descriptor for cards`

---

## Task 4: Rail builder

**Files:**
- Create: `lib/discovery/rails.ts`
- Test: `lib/discovery/rails.test.ts`

**Interfaces:**
- Consumes: `ScoredListing` (Task 2), `getUrgency` (Task 3).
- Produces: `type Rail = { id: string; title: string; subtitle?: string; listings: ScoredListing[] }` and `function buildRails(scored: ScoredListing[], opts: { athleteSport?: string | null; now?: Date }): Rail[]`.

Rules (ordered): 
1. `because-you-<sport>` titled `Because you <sport>` (lowercased sport), listings whose `sport_required` equals `athleteSport` (case-insensitive), sorted by `matchScore` desc, only when `athleteSport` is set and at least 1 match. Cap 12.
2. `new-this-week` titled `New this week`, `getUrgency().kind === 'new'`, sorted by `created_at` desc. Cap 12.
3. `closing-soon` titled `Closing soon`, `getUrgency().kind === 'closing'`, sorted by ascending `days`. Cap 12.
4. Always append `top-matches` titled `Top matches` with all listings sorted by `matchScore` desc (cap 12) so the feed is never empty even when the above are empty.
A listing may appear in more than one rail (that is expected in a feed). Empty rails (1 to 3) are omitted. `buildRails([])` returns `[]`.

- [ ] **Step 1: Write the failing test** covering: on-sport rail appears and is score-sorted; new/closing rails filter correctly; `top-matches` always present when input non-empty; empty input returns `[]`; a rail with no members is omitted. (Build small `ScoredListing` fixtures inline, reusing the Task 2 `base` shape plus `matchScore`/`matchReasons`.)

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement** `buildRails` per the rules above, using `getUrgency` for the new/closing partitions and a stable sort helper. Keep it pure (accept `now` via opts, default `new Date()`).

- [ ] **Step 4: Run tests** PASS; type-check clean.

- [ ] **Step 5: Commit** — `feat(discovery): rail builder for the made-for-you feed`

---

## Task 5: Pay-type facet in the filter hook

**Files:**
- Modify: `components/discovery/listings-filter.tsx` (`FacetKey`, `FACETS`, `EMPTY_FILTERS`, filter predicate, `facetOptions`)
- Test: `components/discovery/listings-filter.test.tsx` (or the existing test file for this module)

**Interfaces:**
- Produces: a `payType` facet whose values are the `job_listings.pay_type` enum: `flat_fee`, `monthly_retainer`, `per_post`, `revenue_share`, labelled `Flat fee` / `Monthly retainer` / `Per post` / `Revenue share`.

- [ ] **Step 1: Write the failing test** — render/hook test asserting that setting the `payType` filter to `per_post` drops listings whose `pay_type !== 'per_post'` from `filtered`. Mirror the existing budget-facet test in this file.

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement** — add `'payType'` to `FacetKey`; add `{ key: 'payType', label: 'Pay type' }` to `FACETS`; add `payType: null` to `EMPTY_FILTERS`; in the predicate add `if (filters.payType && l.pay_type !== filters.payType) return false`; add `payType` to `facetOptions` with the four enum options and labels above.

- [ ] **Step 4: Run tests** PASS; type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(discovery): pay-type filter facet`

---

## Task 6: MatchScore badge component

**Files:**
- Create: `components/discovery/match-score.tsx`
- Test: `components/discovery/match-score.test.tsx`

**Interfaces:**
- Produces: `function MatchScore({ score, size, className }: { score: number; size?: 'sm' | 'lg'; className?: string })`.

**Responsibility & visuals (source: `score-ring.html` flavor A1, "solid sweep"):** an SVG fit ring. A grey track circle (`--track`, fall back to `--border`) and a `--primary` progress arc, `stroke-linecap="round"`, both with `pathLength="100"` so the arc is `stroke-dasharray="100"` and `stroke-dashoffset={100 - score}`. The score number is centered in `font-mono` tabular-nums; a small `match` caption sits under `lg`. On mount the arc animates from `stroke-dashoffset:100` (empty) to `100 - score` via a CSS transition (~1000ms `cubic-bezier(.16,1,.3,1)`); gate the transition behind `prefers-reduced-motion: reduce` (snap to final). `sm` is ~46px for the card/overlay, `lg` is ~72px for the card back. Accessible name `Match score N out of 100` on the wrapping element; the SVG is `aria-hidden`. All colours from theme tokens so it holds in light and dark. Add a test that a 100 score renders `stroke-dashoffset` 0 and a 0 score renders 100.

- [ ] **Step 1: Write the failing test**
```tsx
import { render, screen } from '@testing-library/react'
import { MatchScore } from './match-score'
it('exposes the score as an accessible label', () => {
  render(<MatchScore score={92} />)
  expect(screen.getByLabelText('Match score 92 out of 100')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement** the component with the tokens/classes above.

- [ ] **Step 4: Run tests** PASS; type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(discovery): scoreboard match-score badge`

---

## Task 7: OpportunityCard + card-back detail

**Files:**
- Create: `components/discovery/opportunity-card.tsx`
- Create: `components/discovery/opportunity-detail.tsx`
- Test: `components/discovery/opportunity-card.test.tsx`, `components/discovery/opportunity-detail.test.tsx`

**Interfaces:**
- Consumes: `ScoredListing` (Task 2), `getUrgency` (Task 3), `MatchScore` (Task 6), the brand helpers (`brandInitials`/`brandColor`/`brandCoverDataUri`, extracted from `listing-card.tsx` into this file or a shared `components/discovery/brand-visual.ts` — extract so both card and detail share them).
- Produces: `function OpportunityCard({ listing }: { listing: ScoredListing })`, `function OpportunityDetail({ listing, open, onOpenChange }: { listing: ScoredListing; open: boolean; onOpenChange: (o: boolean) => void })`.

**Responsibility & visuals:** OpportunityCard is the Live Board card from the mockup: `MatchScore size="sm"` top-left, an urgency chip from `getUrgency` (uppercase, letter-spaced; `closing` uses `--warning` tint, `new` uses `--lime-tint-2`), brand lockup (real `brand_logo_url` else coloured monogram), campaign title, the single strongest match reason (first of `matchReasons`, with a check icon; hidden when none), a `font-mono` meta row (pay via the existing `payDisplay` logic, deadline), and Save + Skip affordances. Clicking the card (or a "Details" control) opens `OpportunityDetail`. OpportunityDetail is the card-back: brand story (logo/monogram, brand name, `brand_description`), the full `matchReasons` list under a `Why this ranks for you` heading, a terms row (pay, contract length, deadline), and two actions: Save (POST `/api/discovery/shortlist` `{ target_user_id: brand_user_id }`) and Send request (the existing connection composer moved out of `listing-card.tsx` — reuse its dialog body, `CONNECTION_MESSAGE_*` bounds, `track('connection_request_sent', ...)`, and error handling verbatim). Save is disabled when `brand_user_id` is null.

- [ ] **Step 1: Write failing tests** — OpportunityCard renders title, brand name, the strongest reason, and the mono pay; the urgency chip shows for a closing listing. OpportunityDetail renders `brand_description` and every reason, and its Send-request button is disabled until the message reaches `CONNECTION_MESSAGE_MIN`. (Reuse assertions from the existing `listing-card.test.tsx` for the composer behaviour.)

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement** both components. Extract the brand-visual helpers and the connection composer so nothing is duplicated between the old card (still present until Task 11) and these.

- [ ] **Step 4: Run tests** PASS; type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(discovery): Live Board opportunity card and card-back`

---

## Task 8: OpportunityRail

**Files:**
- Create: `components/discovery/opportunity-rail.tsx`
- Test: `components/discovery/opportunity-rail.test.tsx`

**Interfaces:**
- Consumes: `Rail` (Task 4), `OpportunityCard` (Task 7).
- Produces: `function OpportunityRail({ rail, index }: { rail: Rail; index: number })`.

**Responsibility & visuals:** the mockup rail header (two-digit mono index, a lime pulse dot, the title with a lime underline, a right-aligned `N in rail` count) above a horizontally scrollable row (`overflow-x-auto`, `snap-x`) of `OpportunityCard`s. The horizontal container must not trap vertical page scroll (use `overscroll-behavior-x: contain`). Keyboard: cards are reachable via tab; the row is a labelled region (`aria-label={rail.title}`).

- [ ] **Step 1: Write the failing test** — renders the rail title and one card per listing; the region is labelled by the title.

- [ ] **Step 2: Run and confirm it fails.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests** PASS; type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(discovery): horizontal opportunity rail`

---

## Task 9: Swipe deck primitive opt-in props

**Files:**
- Modify: `components/ui/swipe-card.tsx` (`SwipeCardProps`: add `glossy?: boolean`, `overlay?: React.ReactNode`; render a gloss highlight layer and a top-left figure overlay when provided)
- Test: `components/ui/swipe-card.test.tsx`

**Interfaces:**
- Produces: `SwipeCardProps.glossy?: boolean`, `SwipeCardProps.overlay?: React.ReactNode`. Defaults keep the current look exactly (team-side usages unaffected).

**Responsibility:** when `glossy`, add a non-interactive gloss sheen over the card surface (a soft top linear-gradient highlight, `pointer-events-none`, `aria-hidden`) matching `direction-b-editorial.html`'s plastic material; gate any moving sheen behind `prefers-reduced-motion`. When `overlay` is set, render it absolutely in the figure's top-left (this carries the `MatchScore` onto the deck card).

- [ ] **Step 1: Write the failing test** — with `glossy` the card contains an element with `data-testid="swipe-gloss"`; without it, none. With `overlay={<span>92</span>}` the overlay text renders. Existing SwipeCard tests still pass unchanged.

- [ ] **Step 2: Run and confirm it fails.**

- [ ] **Step 3: Implement** the two opt-in props.

- [ ] **Step 4: Run tests** — full `swipe-card.test.tsx` PASS (including untouched cases); type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(ui): opt-in glossy + overlay props on SwipeCard`

---

## Task 10: DiscoverDeck (progress, save flourish, payoff)

**Files:**
- Create: `components/discovery/discover-deck.tsx`
- Test: `components/discovery/discover-deck.test.tsx`

**Interfaces:**
- Consumes: `SwipeDeck`/`SwipeCard` (Task 9), `ScoredListing`, `MatchScore`, the shortlist POST.
- Produces: `function DiscoverDeck({ listings }: { listings: ScoredListing[] })`.

**Responsibility & visuals:** wraps `SwipeDeck` for the athlete surface. Maps each `ScoredListing` to a `SwipeCardProps` card with `glossy`, `overlay={<MatchScore size="sm" score={l.matchScore} />}`, the brand cover image, title, brand subtitle, strongest reason as `seeking`, pay as `availability`, `likeIcon={Bookmark}`, `likeLabel="Save"`, `passLabel="Skip"`, `showActionLabels`. A progress bar above the deck shows `reviewed / total` (lime fill, `role="progressbar"` with `aria-valuenow`). Right swipe saves via `/api/discovery/shortlist` (same call as the current `listings-browser`, targeting `brand_user_id`, treating 409 as success) and shows a brief non-blocking save flourish (toast plus a lime pulse; `prefers-reduced-motion` shows only the toast). When the queue empties, render the end-of-deck payoff: `You saved N. Send requests?` with a primary link to `/athlete/saved` and a secondary "Review again" that resets the queue. When N is 0, the payoff reads `No saves this round` with a "Start over" action. Copy has no em dashes.

- [ ] **Step 1: Write failing tests** — progress bar starts at 0 of N; after a right swipe the saved count increments and the shortlist endpoint is called with the brand user id; when the queue is empty the payoff shows the saved count and a link to `/athlete/saved`. (Drive swipes through the Skip/Save buttons, as the existing `listings-browser.test.tsx` does; mock `fetch`.)

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests** PASS; type-check + lint clean.

- [ ] **Step 5: Commit** — `feat(discovery): swipe deck with progress and end-of-deck payoff`

---

## Task 11: DiscoverFeed orchestrator + wire the page, remove old components

**Files:**
- Create: `components/discovery/discover-feed.tsx`
- Modify: `app/(athlete)/athlete/discover/page.tsx`
- Delete: `components/discovery/listings-browser.tsx` (+ test), `listings-grid.tsx` (+ test), `listing-card.tsx` (+ test)
- Test: `components/discovery/discover-feed.test.tsx`, update `app/(athlete)/athlete/discover/page.test.tsx`

**Interfaces:**
- Consumes: `ScoredListing`, `Rail`, `useListingFilters`/`ListingsToolbar` (Task 5), `OpportunityRail` (Task 8), `OpportunityCard` (Task 7), `DiscoverDeck` (Task 10), `BrowseModeToggle`/`useBrowseMode`.
- Produces: `function DiscoverFeed({ listings, rails, initialMode, athleteSport, footer? }: { listings: ScoredListing[]; rails: Rail[]; initialMode: BrowseMode; athleteSport: string | null; footer?: React.ReactNode })`.

**Responsibility & visuals:** the client orchestrator. Renders the `BrowseModeToggle` (marketplace vs swipe, persisted via `useBrowseMode`). In swipe mode: the deck-entry callout (stacked-card teaser from `direction-c-kinetic.html`) plus `DiscoverDeck`. In marketplace mode: the `ListingsToolbar` (with the new pay-type facet); when `hasActiveFilters` is false, render the rails (`OpportunityRail` per `rails` entry); when a search or filter is active, render a flat responsive grid of `OpportunityCard`s off `filters.filtered` (so search/filter stays useful and rails do not fight the query). Keep the deck-entry callout visible above the rails in marketplace mode too, so the deck is discoverable as the star.

The page (`page.tsx`): after fetching `listings`/`mode`/`profile`, call `decorateWithMatch(listings, athlete)` then `buildRails(scored, { athleteSport: athlete?.primary_sport ?? null })`, and render `<DiscoverFeed listings={scored} rails={rails} initialMode={mode} athleteSport={athlete?.primary_sport ?? null} footer={...loadMore} />`. Keep the existing masthead copy or update it to `Ranked for you, <sport>` when a sport is known.

- [ ] **Step 1: Write failing tests** — DiscoverFeed in marketplace mode with no filters renders rail titles; applying a filter switches to the flat grid; swipe mode renders the deck entry and the deck. Update `page.test.tsx` expectations to the new component. Run them and confirm they fail.

- [ ] **Step 2: Implement** DiscoverFeed and rewire `page.tsx`.

- [ ] **Step 3: Delete** the three old components and their test files.

- [ ] **Step 4: Run the FULL suite** — `npm run check`. Fix any references to the deleted components until green.

- [ ] **Step 5: Commit** — `feat(discovery): Live Board discover feed replaces the flat grid`

---

## Task 12: Visual verification on staging

**Files:** none (verification task).

- [ ] **Step 1:** Push `feat/discover-redesign` and open the Vercel preview (`podium-git-staging-podium6.vercel.app`), signed in as the surfing athlete. Do NOT run many concurrent browser agents against the one login (refresh-token rotation races drop the session).
- [ ] **Step 2:** Verify against the approved mockup: masthead, filter bar with pay-type, rails (Because you surf / New this week / Closing soon / Top matches), scoreboard scores, urgency chips, card-back brand story + reasons + terms, and the swipe deck (progress bar, glossy cards, save flourish, end-of-deck payoff routing to `/athlete/saved`). Note the staging data reality: in-app brands have no uploaded logos, so branded tiles are expected.
- [ ] **Step 3:** Screenshot each surface in the user's Chrome, compare to the mockup, fix any gaps in a follow-up commit, and report the result to the user with the screenshots.

---

## Self-Review

- **Spec coverage:** Tier A: match score (Tasks 2, 6), why/reasons (Tasks 2, 7), made-for-you rails (Tasks 4, 8, 11), urgency badges (Tasks 3, 7), swipe payoff (Tasks 9, 10). Tier B: brand-description card back (Tasks 1, 7), pay-type filter (Task 5). Glossy deck (Task 9), stacked-card deck entry (Task 11). Deferred items are explicitly out. Covered.
- **Type consistency:** `ScoredListing` (Task 2) flows through Tasks 4, 7, 8, 10, 11. `Rail` (Task 4) used in 8, 11. `getUrgency` (Task 3) used in 4, 7. `MatchScore` (Task 6) used in 7, 10. `glossy`/`overlay` (Task 9) used in 10. Names consistent.
- **No schema change:** confirmed; `brand_profiles.description` already exists.
- **Green gate:** old components deleted only in Task 11 after their replacements exist, so intermediate commits stay green.
