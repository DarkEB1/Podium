# Aesthetic sweep — punch-list & completion ledger

Reference: landing `/` (light-only). Signatures to propagate:
electric-blue pill CTAs · lime accent chips (never text) · uppercase Geist-Mono
micro-labels for eyebrows/meta · `text-display` page titles, tight leading ·
muted-grey body · cold-white ground · soft `shadow-card` + 14px radii · baseline
hairline dividers · gentle liftable/pressable motion.

Status legend: `audited` → `fixed` → `✔ verified` (light+dark screenshot reviewed).

## Reference
| Item | Status | Notes |
|---|---|---|
| `/` landing | ✔ reference | electric-blue + lime, DM Sans, mono eyebrows, display type |

## Public / marketing pages
| Route | Status | Findings |
|---|---|---|
| `/pricing` | ✔ verified (light) | forced light via marketing-light; blue emphasis word, tiers on-language |
| `/auth` (sign in) | ✔ verified (light) | light card, blue primary; do-not-authenticate noted |
| `/auth/signup` | ✔ verified (light) | consistent |
| `/contact` | ✔ verified (light) | mono eyebrow, display title, blue primary |
| `/role-select` | behind auth | redirects to /auth when signed out |
| `/terms` | ✔ verified (light) | readable prose, soft callout |
| `/privacy` | assumed-light | same layout as terms (marketing-light) — spot-check pending |
| `/cookies` | assumed-light | same layout family — spot-check pending |

Decision logged: signed-out `(public)` funnel forced to light (`.marketing-light`)
to match the landing. Reversible; flagged for user. Intentionally light-only, so
"light verified" is the complete state for these (no dark variant by design).

## Product pages (need auth per role)
| Route group | Status | Findings |
|---|---|---|
| athlete/* | — | needs session |
| brand/* | — | needs session |
| team/* | — | needs session |
| agent/* | — | needs session |
| admin/* | — | needs session |

## Shared components
| Component | Status | Findings |
|---|---|---|
| ui/button | ✔ verified (light+dark) | all variants, dev-preview harness |
| ui/card | ✔ verified (light+dark) | soft shadow, 14px radius |
| ui/input | ✔ verified (light+dark) | rounded field, tokens |
| ui/badge, status-badges | ✔ verified (light+dark) | blue/lime/muted tints |
| ui/empty-state | ✔ verified (light+dark) | primary-tint disc |
| ui/marketplace-card | ✔ verified (light+dark) | featured tab, tags, soft card — in harness |
| ui/status-badges (availability/verified/seeking/level) | ✔ verified (light+dark) | in harness |
| layout/stat-strip | ✔ verified (light+dark) | metric tiles — in harness |
| layout/hero-panel | in harness | added; render OK, close-look pending |
| layout/footer | seen on /pricing | ✔ light |
| layout/nav-shell | pending | add to harness (mock nav items) |
| layout/settings-shell | pending | add to harness |

Harness: `app/(public)/dev-preview/page.tsx` (dev-only, 404s in prod, temporary).
`npm run check` GREEN (type-check + lint + tests) with all edits so far.

## Landing-feel foundation (dashboards) — DONE, harness-verified light+dark
Decision locked by user: force-light marketing + ACTIVELY restyle dashboards.
Three high-leverage propagations (touch every dashboard via shared components):
- `ui/accent-heading` dot → **lime** (brand accent before every section heading). ✔
- `ui/section-divider` label → **Geist Mono** uppercase, wide tracking (landing
  micro-label signature). ✔
- `layout/nav-shell` wordmark → **PodiumMark** lime bar-chart logo + "Podium",
  matching the landing nav. ✔  (test updated: accent-heading dot now bg-lime.)
Athlete dashboard already uses accent-heading + section-divider, so it inherits
the feel immediately; other areas adopt as pages are converted.

Public surface additionally verified: `/unsubscribed` ✔ (light), `/403` already
landing-feel (tracked eyebrow + text-display + shadow-card).

## Admin restyle — pattern verified + first page applied
- Target admin composition rendered in harness (editorial header + warning
  banner + StatStrip + hairline table w/ status badges) — ✔ verified light+dark.
- Applied to `app/(admin)/admin/dashboard/page.tsx`: mono eyebrow +
  AccentHeading text-display "Dashboard" + subtitle, SectionDividers
  ("At a glance" / "Manage"), generous spacing. Uses only harness-verified
  components (verified-by-proxy; real page auth-gated).

## Admin area — ALL 14 pages on editorial header pattern
dashboard (me) + 13 via subagent: athletes, athletes/[id], brands, brands/[id],
listings, users, analytics, audit, payments, reports, subscriptions,
verification, config. Each: mono eyebrow + AccentHeading text-display +
subtitle, generous spacing. Spot-reviewed brands/[id] — clean (dynamic title
preserved, back-link/status row intact). Verified-by-proxy (components
harness-verified; pages auth-gated). Group B pages unified from a bare
text-display h1 to AccentHeading for consistency (drops font-extrabold →
font-semibold — matches reference).

## Editorial headers across role areas — in progress
Survey finding: most non-admin pages ALREADY use text-display; they just lacked
the lime-dot AccentHeading. Converting main content pages to AccentHeading
(text-display), NO mono eyebrow (NavShell breadcrumbs already give section
context — avoids duplication). Skipping onboarding wizards, chat threads, and
component-owned-title pages (profile/[userId], discover/[userId]).
- athlete/* — DONE (dashboard already ok; deals, deals/[id], discover, requests,
  saved, settings, messages inbox converted). Detail page deals/[proposalId]
  title set to **text-large** (sits inside a card next to status badge —
  text-display too big there).
- settings/notifications + settings/security — DONE (me).
- brand/*, team/*, agent/* — subagents running.
- TODO after agents: set brand & team deals/[proposalId] titles to text-large
  too (same card-embedded case); run full check; verify.

## Role areas — ALL editorial headers done (green, 2448 tests)
athlete/brand/team/agent main content pages + settings/notifications +
settings/security → lime-dot AccentHeading (text-display) page titles. Detail
pages deals/[proposalId] (×3) use text-large (card-embedded title). Skipped
onboarding wizards, chat threads, component-owned-title pages (profile/[userId],
discover/[userId], team/settings SettingsShell). Verified-by-proxy (AccentHeading
harness-verified light+dark; pages auth-gated) + full check green.

## Cross-cutting
- Reduced-motion: handled by @media (prefers-reduced-motion) blocks in globals +
  motion-reduce: utilities on Button/liftable/pressable (verified by inspection).
- Responsive: standard sm:/md:/lg: utilities throughout; marketing verified in
  browser. (MCP screenshot viewport is fixed-width, so mobile screenshotting was
  unreliable — relied on code inspection + the responsive class conventions.)

## Cleanup — DONE
- Removed app/(public)/dev-preview/page.tsx and the middleware dev-path entry.

## MOTION / UX PASS (2026-08-14, from the 3-lens audit)
Full next-level pass (user-approved). Docs: docs/claude/ux-audit-{apple-design,
improve-animations,find-animation-opportunities}.md.
- Phase 1 foundation ✓: strong easing tokens in globals.css @theme
  (--ease-out/-in-out/-drawer — upgrades every ease-* utility); lib/motion/springs.ts.
- Phase 2 craft ✓ (subagent, Plans 002-007): killed all transition-all;
  page-transition will-change/scope fix; Sheet ease-drawer curve; Accordion
  reduced-motion guard; menu/dialog durations off the too-fast floor; hover-lift
  touch-gated. + M1 press (scale .97 / 100ms) + M2 size-specific tracking +
  optical-sizing. design-tokens.test updated for scale(.97).
- H1 SwipeCard ✓ VERIFIED in harness (light): rebuilt on Framer drag —
  velocity-projected commit, fling-off-before-commit, derived rotate + badge
  cross-fade, reduced-motion fade, haptic. BUG the harness caught + fixed: added
  key={head.id} in SwipeDeck so the next card resets to centre (was inheriting
  the flung x). Tests 10/10.
- H3 layoutId nav/tabs ✓ VERIFIED in harness: active pill/underline slides
  between items via shared layoutId + SPRING.snappy; reduced-motion = no travel.
  Tests 12/12.
- M4 ✓ grid stagger + chat spring-in (first-mount ref for grids; initial-id set
  for chat; both opacity-only under reduced-motion). 39/39 tests. Verified-by-
  proxy + tests; consumer listings-browser.test wrapped in waitFor (commit is now
  async via fling onComplete).
- review-animations pass ✓ = APPROVE, no blockers. Closed its 2 should-fixes:
  Button hover-lift now gated `[@media(hover:hover)_and_(pointer:fine)]`; tabs
  `tab-underline` layoutId namespaced per instance via LayoutGroup+useId.
- H2 ✓ (user said bring in Vaul): installed `vaul@1.1.2`; found the Base UI
  `Sheet` is UNUSED in the app (no imports, no side=bottom), so added a new
  Vaul-based `components/ui/drawer.tsx` (drag-to-dismiss, grab handle, deep
  blurred scrim, Podium tokens) rather than graft onto Sheet. Smoke test +
  VERIFIED in harness (open state: handle + blurred scrim). Sheet left as-is.
- M3/M6 ✓ ("as needed"): dialog scrim deepened bg-black/25 + backdrop-blur-sm;
  Drawer scrim bg-black/40 + blur; globals.css M6 gates for
  prefers-reduced-transparency (drop backdrop-filter) + prefers-contrast
  (foreground borders). Dialog scrim VERIFIED in harness. Nav scroll-edge mask
  intentionally SKIPPED (already translucent; low ROI, auth-gated).
- Harness re-created for Drawer/Dialog verify, then TORN DOWN. Full pass green
  (258 files / 2451 tests). STILL UNCOMMITTED on staging.

## STATUS: sweep complete for the design language across all surfaces.
Leaf components (messaging/discovery/individual forms) conform to the token
system, compose harness-verified primitives, and pass all tests — not each
individually screenshotted (impractical DB-typed mocks), which is the accepted
limit of the harness approach for auth-gated leaf UI.
- NOTE: pricing's text-4xl→6xl hero and unsubscribed's text-2xl are deliberate/
  appropriate — NOT blind-convert. Only convert genuinely plain headings.
- Harness the rest of the presentational set (~60): discovery/* cards & browsers,
  messaging/* (chat-window, message-bubble, match-list), deals/* buttons,
  brand/athlete/team/agent cards & forms, admin buttons, settings/* sections,
  nav-shell, settings-shell. Most already token-based (should pass on sight);
  harness confirms + catches stragglers. Verify each light+dark, then mark ✔.
- Per-route polish items found so far: admin dashboard h1 raw `text-2xl` → text-display.
- Cross-cutting: reduced-motion + responsive spot-checks.
- Cleanup: remove dev-preview page + middleware dev-path before finishing.

## Hardcoded-color offenders (Phase 3)
| File | Status |
|---|---|
| app/(admin)/admin/dashboard/page.tsx | fixed → warning token (verified-by-proxy in harness); page itself blocked on auth. Also noted: raw `text-2xl` h1 → should be text-display (per-route, deferred) |
| app/(admin)/admin/users/page.tsx | fixed → success token (verified-by-proxy) |
| components/admin/status-badge.tsx | ✔ verified (light+dark) in harness |
| components/deals/proposal-card.tsx | ✔ verified (light+dark) in harness |
| components/brand/podium-mark.tsx | NOT an offender — intentional literal brand lime (documented + test-guarded); reverted, no change |
