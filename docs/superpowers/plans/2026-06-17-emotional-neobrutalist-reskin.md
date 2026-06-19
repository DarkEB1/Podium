# Emotional Design + Subtle Neo-Brutalist Re-skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md: TDD, `npm run check` clean before any task reports done.

**Goal:** Give Podium subtle neo-brutalist character + emotional design (energetic voice, Lucide icons, Bricolage Grotesque headings, characterful empty states, micro-interactions) by re-skinning the shared tokens + ~12 primitives, so all ~50 leaf screens inherit it.

**Architecture:** Re-skin the centre, not the leaves. Task 1 re-skins the design tokens + swaps the heading font + adds page texture (every other task depends on it). Then independent tasks re-skin one primitive / add one bespoke element each (disjoint files), plus a microcopy constants module that empty states/toasts/CTAs consume. Leaf role screens are NOT edited except to drop in a bespoke element or a `copy.*` string.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind 4 + shadcn/ui (`@base-ui/react`, no `asChild`), `lucide-react` (already installed), Vitest (co-located), `next/font/google`.

**Design doc:** `docs/superpowers/specs/2026-06-17-emotional-neobrutalist-reskin-design.md`.

---

## 0. Execution Rules (every task)

1. **Only touch your task's files.** Re-skins change `components/ui/*` and `components/layout/*` visuals only — never a leaf role screen, except Task 16 (microcopy wiring) and Task 17 (bespoke-element placement), which edit named leaf files.
2. **Keep public APIs stable.** Primitive prop signatures don't change; only classes/markup/interactions do. If a re-skin would break a prop, stop and flag it.
3. **TDD.** Update the co-located test first. Re-skins commonly break existing render/snapshot tests and tests asserting old microcopy strings — update those in the same task.
4. **Reduced motion.** Every movement-based interaction must degrade to opacity/shadow-only under `prefers-reduced-motion: reduce`.
5. **Accessibility.** Keep visible labels; status never colour-alone (pair a Lucide icon/text); keep focus visible.
6. **Verify before done:** `npm run type-check` + `npm run lint` + your vitest paths clean; then commit `style(scope): <task-id> <summary>` (or `feat`/`refactor` as fitting).

---

## 1. Locked Contracts (consumed across tasks — must match exactly)

### 1.1 Tokens (Task 1 → `app/globals.css` `:root`)
```css
--border-ink: oklch(0.20 0 0);
--border-ink-width: 1.5px;
--border: oklch(0.88 0 0);                 /* soft grey, minor dividers only */
--radius: 0.625rem;                         /* 10px (was 0.75rem) */
--shadow-card:       3px 3px 0 oklch(0.20 0 0 / 0.92);
--shadow-card-hover: 6px 6px 0 oklch(0.20 0 0 / 0.92);
--shadow-press:      2px 2px 0 oklch(0.20 0 0);
--shadow-focus:      3px 3px 0 var(--primary);
--accent: oklch(0.80 0.13 85);              /* punchier amber for flat blocks */
```
Tailwind `@theme inline` exposes `--shadow-card`, `--shadow-card-hover`, `--shadow-press`, `--shadow-focus`, `--color-border-ink`. Headings: `--font-heading`; body `--font-sans`; heading `line-height:1.18; letter-spacing:-0.01em`; body `line-height:1.55`.

### 1.2 Font wiring (Task 1 → `app/layout.tsx`)
```ts
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from 'next/font/google'
const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], display: 'swap' })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// body className: `${bricolage.variable} ${dmSans.variable} ${geistMono.variable} antialiased`
```
`globals.css @theme inline`: `--font-heading: var(--font-bricolage);` (remove the Syne import).

### 1.3 Icon wrapper (Task 2 → `components/ui/icon.tsx`)
```tsx
import type { LucideIcon } from 'lucide-react'
export function Icon({ icon: I, size = 20, className }: { icon: LucideIcon; size?: number; className?: string }) {
  return <I size={size} strokeWidth={2} className={className} aria-hidden="true" />
}
```
`lib/copy/icon-map.ts` maps concepts → Lucide components: `target:Target, availability:Circle, verified:BadgeCheck, team:Shield, partners:Users, proposal:Send, payments:Wallet, search:Search, energy:Zap, megaphone:Megaphone, trophy:Trophy, saved:Bookmark`.

### 1.4 Microcopy module (Task 3 → `lib/copy/index.ts`)
```ts
export const copy = {
  toasts: {
    profileLive: "You're on the radar — profile is live!",
    proposalSent: "Proposal sent. Game on.",
    saved: "Saved to your shortlist.",
  },
  emptyStates: {
    noMatches:   { title: "No matches yet — let's fix that", body: "Brands can't pick you if they can't see you. Round out your profile and you'll start showing up in their search.", cta: "Finish my profile" },
    noResults:   { title: "Nothing here yet", body: "Widen your filters and dig in — there's talent waiting.", cta: "Clear filters" },
    noDeals:     { title: "No deals yet", body: "Send a proposal and get the ball rolling.", cta: "Browse opportunities" },
    emptyInbox:  { title: "Your inbox is quiet", body: "Once a match starts talking, it shows up here.", cta: null },
  },
  cta: { sendProposal: "Send proposal · make your move", finishProfile: "Finish my profile" },
  prompts: { addPhoto: "Add a photo so brands can put a face to the talent" },
} as const
```
Add `docs/brand/voice.md` (one-page voice guide).

### 1.5 Motion utilities (Task 1 → `globals.css`)
```css
.pressable{ transition:transform .08s ease, box-shadow .08s ease; }
.pressable:active{ transform:translate(2px,2px); box-shadow:0 0 0 var(--border-ink); }
.liftable{ transition:transform .12s ease, box-shadow .12s ease; }
.liftable:hover{ transform:translate(-2px,-2px); box-shadow:var(--shadow-card-hover); }
@media (prefers-reduced-motion: reduce){
  .pressable, .liftable{ transition:box-shadow .08s ease; }
  .pressable:active, .liftable:hover{ transform:none; }
}
```

---

## 2. Standard per-task steps
Each task below = (1) read §1 contracts + your files; (2) update the failing co-located test for the new
visual/behavioural contract, run it, confirm fail; (3) implement; (4) `npm run type-check && npm run lint &&
npx vitest run <paths>` clean; (5) commit; (6) return `{taskId, filesChanged[], status, followUps[]}`.

---

## 3. Tasks

### Task 0: gitignore
**Files:** Modify `.gitignore`. Add `.superpowers/`. Commit. (No test.)

### Task 1: Token + font + texture foundation — **all others depend on this**
**Files:** `app/globals.css`, `app/layout.tsx`, `app/layout.test.tsx` (if present).
- Apply §1.1 tokens, §1.2 font wiring (remove Syne, add Bricolage), §1.5 motion utilities.
- Add page grain: `body { background-image: url("data:image/svg+xml,…fractalNoise…opacity 0.035"); }`.
- Headings use `--font-heading` at line-height 1.18; body line-height 1.55.
- **Test:** assert `--font-bricolage` variable class is applied to `<body>`; assert no `Syne` import remains
  (grep-style unit or a layout render test). **Acceptance:** app boots, `npm run check` green, headings render
  in Bricolage, page shows grain.

### Task 2: Icon wrapper + icon-map
**Files:** Create `components/ui/icon.tsx`, `lib/copy/icon-map.ts`, `components/ui/icon.test.tsx`.
- §1.3. **Test:** `<Icon icon={Target} />` renders an svg with `stroke-width=2`, `aria-hidden`. Acceptance:
  importable everywhere.

### Task 3: Microcopy module + voice guide
**Files:** Create `lib/copy/index.ts`, `docs/brand/voice.md`, `lib/copy/index.test.ts`.
- §1.4. **Test:** `copy.toasts.profileLive` equals the locked string; shape is `as const`. Acceptance: typed,
  importable.

### Task 4: Button re-skin (`components/ui/button.tsx`) `← T1`
Ink border + `--shadow-press` + `.pressable`; label uses heading font weight. Keep all variants/sizes/props.
**Test:** rendered button has the ink-border + press classes; variants still apply. Reduced-motion respected.

### Task 5: Card + MarketplaceCard re-skin (`components/ui/card.tsx`, `components/ui/marketplace-card.tsx`) `← T1`
Ink border, `--shadow-card`, `.liftable` on marketplace card; image area keeps ratio. Add `featured?: boolean`
prop to MarketplaceCard → folded-corner tab (CSS `::after`). **Test:** card has ink border + shadow token;
`featured` renders the corner; hover lift class present.

### Task 6: Badges re-skin (`components/ui/badge.tsx`, `components/ui/status-badges.tsx`) `← T1, T2`
Flat blocks + ink border; AvailabilityBadge green/amber/red **with a Lucide `Circle` icon** (never colour
alone); VerifiedBadge `BadgeCheck` blue/grey; LevelChip accent block; SeekingTag low-opacity primary.
**Test:** availability badge includes an icon + text for each status; verified shows blue vs grey.

### Task 7: Inputs re-skin (`components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/combobox.tsx`) `← T1`
Ink border; focus → `--shadow-focus` + primary border (replace soft ring). Keep visible labels. **Test:** focus
state applies the focus-shadow class; label still rendered.

### Task 8: CardSelect re-skin (`components/ui/card-select.tsx`) `← T1`
Selected tile = accent-tint fill + primary ink border + `--shadow-press`. Keep single/multi/max API. **Test:**
selected tile carries the selected classes; max behaviour unchanged.

### Task 9: EmptyState re-skin (`components/ui/empty-state.tsx`) `← T1, T2, T3`
Circular accent disc + `Icon` + energetic title/body/CTA; defaults pull from `copy.emptyStates` when given a
known `variant`, else use props. **Test:** renders disc+icon+title+CTA; `variant="noMatches"` uses the locked
copy.

### Task 10: CardSkeleton re-skin (`components/ui/card-skeleton.tsx`) `← T1`
Match new bordered card silhouette (ink border, no shadow while loading), same proportions as MarketplaceCard.
**Test:** skeleton has the bordered silhouette; dimensions match card.

### Task 11: Toast re-skin (`components/ui/sonner.tsx`) `← T1, T2`
Bordered block + 6px left accent bar coloured by status + hard shadow + Lucide status icon. **Test:** success
toast renders left-bar + `BadgeCheck`/`Check` icon.

### Task 12: Surfaces re-skin (`components/ui/tabs.tsx`, `components/ui/dialog.tsx`, `components/ui/sheet.tsx`) `← T1`
Ink borders + hard shadow on the surfaces; keep the v1 scale/slide transitions. **Test:** dialog/sheet surface
has ink border + shadow token; transitions intact.

### Task 13: Sticker + SectionDivider + AccentHeading (`components/ui/sticker.tsx`, `components/ui/section-divider.tsx`, `components/ui/accent-heading.tsx`) `← T1`
Per spec §7. Sticker: rotated accent pill (ink border, hard shadow). SectionDivider: ink rule + solid label
chip. AccentHeading: heading with accent swipe behind. **Test:** each renders with expected structure/props.

### Task 14: StatStrip re-skin (`components/layout/stat-strip.tsx`) `← T1, T2`
Bordered stat tiles + hard shadow + a Lucide icon per metric (icon passed or mapped). **Test:** tile has ink
border + shadow + icon slot.

### Task 15: NavShell + SettingsShell + HeroPanel polish (`components/layout/nav-shell.tsx`, `settings-shell.tsx`, `hero-panel.tsx`) `← T1`
Apply ink borders / accent active-state to nav, settings two-column rule, hero floating panel border+shadow.
Keep structure/props. **Test:** active nav item uses primary accent; shells render unchanged structurally.

### Task 16: Microcopy wiring `← T3, T9, T11`
**Files (named leaf/owned):** the subscription "Most popular" sticker location (`components/brand/subscription-tiers.tsx`),
toast call-sites in `lib/` dispatchers / page actions that publish profiles / send proposals, and the athlete
photo prompt (`components/athlete/profile-wizard.tsx`). Replace hardcoded strings with `copy.*`. **Test:** update
the co-located tests that assert the OLD strings to the new `copy.*` values (these WILL be failing otherwise).
**Acceptance:** no emoji remain in UI strings (grep), key flows show energetic copy.

### Task 17: Bespoke-element placement `← T5, T13, T14`
**Files (named leaf):** `components/brand/subscription-tiers.tsx` (Sticker "Most popular"/"7-day free trial",
`featured` card), dashboards (`app/(athlete)/athlete/dashboard`, `app/(brand)/brand/dashboard`, team/agent
dashboards) for StatStrip + AccentHeading + SectionDivider on primary sections. Only drop in components; no
layout rewrites. **Test:** subscription page renders the Most-popular sticker; a dashboard renders an
AccentHeading. **Acceptance:** spec §12.5 met.

### Task 18: Emoji + verification sweep `← all`
**Files:** any (verification/fixups). Grep the codebase for emoji in `.tsx`/`.ts` UI strings and replace with
Lucide/`copy.*`. Run `npm run check` + `npx playwright test`; fix re-skin-induced breakage. Confirm WCAG AA
contrast on accent/ink/primary surfaces (ink-on-amber, white-on-primary). **Acceptance:** spec §12 fully met;
combined coverage report.

---

## 4. Dependency summary
`T0` standalone. `T1` blocks everything. `T2` blocks T6,T9,T11,T14. `T3` blocks T9,T16. After T1 (+T2/T3),
tasks **T4–T15 run in parallel** (disjoint files). `T16 ← T3,T9,T11`. `T17 ← T5,T13,T14`. `T18 ← all`.

---

## 5. Self-Review

**Spec coverage:** §2 decisions → all tasks; §4 tokens/font/texture → T1; §5 icons → T2,T18; §6 primitives →
T4–T12,T14,T15; §7 bespoke elements → T5(corner),T13,T14; §8 micro-interactions → T1(utilities),T4,T5,T7; §9
microcopy → T3,T16; §10 accessibility → baked into T4–T15 + audited T18; §11 out-of-scope respected (no leaf
redesign except T16/T17 string/element drops); §12 acceptance → T1(1),T2/T18(2),T4–T12(3),T9/T16(4),
T13/T14/T17(5),T1/T18(6). No gap.

**Placeholder scan:** no TBD/TODO; every task names exact files, the contract it implements, a concrete test
assertion, and acceptance. Token/font/icon/copy code is literal in §1.

**Type consistency:** `Icon({icon,size,className})`, `copy.*` keys, `featured?` prop, token names
(`--shadow-press`, `--shadow-focus`, `--border-ink`) are used identically in §1 and the tasks that consume them.

**Note:** T16's test step is essential — changing microcopy strings breaks existing tests that assert the old
text across leaf components; those tests are updated within T16, not left red.
