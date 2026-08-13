# Site-wide aesthetic sweep — design

**Date:** 2026-08-12
**Branch:** `staging`
**Related:** `2026-08-05-landing-redesign-design.md`, `2026-08-05-landing-build-spec-v3.md`

## Goal

Make every page and component across Podium visually consistent with the new
landing-page aesthetic (electric-blue + lime, DM Sans, soft "clean Airbnb"
surfaces), so the product feels like one coherent brand to customers.

## Key finding (reframes the task)

This is **not** a new theme build. The design *system* already exists and is
wired app-wide:

- **Tokens** live in a single `app/globals.css` (`@theme` + `:root`/`.dark`):
  `--primary: #2742F0` (electric blue), `--lime: #C1EC2F`, soft `--shadow-card`,
  14px `--radius` family, full light **and** dark palettes.
- **Fonts**: DM Sans wired globally in `app/layout.tsx` (`--font-dm-sans` on
  `<html>`, `font-sans` applied in `globals.css`). Geist Mono for micro-labels.
- **Core primitives** are already re-skinned: e.g. `components/ui/button.tsx`
  uses `bg-primary`, soft `shadow-sm→md`, gentle hover-lift, 12–14px radii.
- Of 368 `.tsx` files, only **6** hardcode off-palette colors and fight the
  tokens (see Phase 2).

What was **never done** is sweeping that new language to *full coverage*. The
landing got the complete art-directed treatment; the system was updated
alongside; but the ~90 routes and ~70 shared components were only partially
migrated. `globals.css` admits it: legacy shadow aliases are "kept so dependent
components resolve **until re-styled**."

So the work is a **coverage + consistency sweep, audit-first** — find where the
new language hasn't landed and finish it — not a rebuild.

## The refresh language (landing DNA → product)

The landing's bespoke parts stay landing-only: the 3D dominoes, the `--floor-y`
line, the editorial hero motion, and the `.landing-light` art-direction scope.
None of that goes on a dashboard or an admin table.

What transfers to every other surface:

- **Type** — DM Sans everywhere (done). Adopt `text-display` for page titles so
  headers feel editorial like the hero; hold to the three-size scale
  (`text-large` / `text-medium` / `text-small`) below that. No raw `text-2xl…7xl`.
- **Color discipline** — electric blue `#2742F0` = primary actions, links,
  active states. **Lime `#C1EC2F` = sparing accent only, NEVER a text color**
  (contrast 1.2:1 on page): active nav pill, selected card, one highlighted
  stat, small badges. Ink foreground on cold-white page; white cards.
- **Surfaces** — soft layered `shadow-card` + 14px radius family; the thin
  `--baseline` hairline as the divider motif, replacing any hard borders or
  offset "press" shadows left from the old neo-brutalist reskin.
- **Motion** — the existing `liftable` / `pressable` / `page-transition`
  feedback, always gated on `prefers-reduced-motion`.
- **Dark mode** — every change must hold in both themes; `.dark` tokens already
  exist, so the rule is "use tokens, never hardcode," verified visually in dark.

## Non-goals

- No 3D / dominoes / floor-line on product or marketing pages.
- No functional/logic/data changes — this is presentation only.
- No unrelated refactors. Touch a file's styling, not its behavior.
- No schema, API, or route changes.

## Execution — shared-first, audit-first

### Phase 0 — Run locally & reach every surface
`npm run dev`; establish sessions for each route group
(athlete / brand / team / agent / admin / public) so every route is reachable in
Chrome at localhost. Capture the auth/seed steps needed.

### Phase 1 — Visual audit (before mass-editing)
Walk every route group in Chrome (parallel subagents per group). For each page
and each shared component, screenshot light + dark and score against the refresh
language checklist. Output: a **punch-list** (`docs/claude/aesthetic-sweep-punchlist.md`)
of everything that is off, grouped by shared-component root cause vs. per-route.
**Review the punch-list before mass-editing.**

### Phase 2 — Shared kit (highest leverage)
Bring the ~15 most-inherited primitives fully into the language, so most pages
lift at once. Known targets (from usage counts): `card`, `input`, `empty-state`,
`badge`, `status-badges`, `marketplace-card`, `route-error`, `page-skeleton`,
and layout chrome `nav-shell`, `footer`, `settings-shell`, `stat-strip`,
`hero-panel`, `section-divider`, `accent-heading`. Confirm/extend from the audit.

### Phase 3 — Fix hardcoded-color offenders
Replace off-token colors with semantic tokens in the 6 known files:
`app/(admin)/admin/dashboard/page.tsx`, `app/(admin)/admin/users/page.tsx`,
`components/admin/status-badge.tsx`, `components/deals/proposal-card.tsx`,
`components/brand/podium-mark.tsx` (raw hex; verify the mark's brand colors are
intentional before changing). Plus any new ones the audit surfaces.

### Phase 4 — Per-route polish
Work the punch-list items that survive the shared-kit lift: page-title tier,
spacing rhythm, lime-accent placement, hairline dividers, per-route specifics.

### Phase 5 — Cross-cutting pass & gate
Dark-mode + reduced-motion + responsive (mobile width) sweep, then
`npm run check` (type-check + lint + test) green. Fix any visual-regression
snapshot/`contrast.test.ts` fallout.

## Acceptance gate — visual verification is mandatory (per user)

**No page and no component is marked complete until it has been rendered in
Chrome at localhost and visually verified against the checklist — in light AND
dark.** Code-correctness is not sufficient; each item passes only on a reviewed
screenshot.

Tracking: the punch-list doubles as the completion ledger. Each row (page or
component) moves `audited → fixed → visually verified ✔` with the light/dark
screenshots attached/linked. The sweep is done only when every row is `✔` and
`npm run check` is green.

Components are verified either in-situ on a real page that uses them, or on a
temporary local-only preview route (removed before finishing) when no page
exercises the relevant state.

## Definition of done

- Every route group and every shared component row on the punch-list is
  `visually verified ✔` in light and dark.
- The 6 (+ any audit-found) off-token files use semantic tokens.
- No landing-only art direction leaked onto product/marketing pages.
- `npm run check` green; no reduced-motion or contrast regressions.
- Changes on `staging`, seen working on the local run; no production deploy as
  part of this work.
