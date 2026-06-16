# Podium v1 Improvements — Parallel Execution Design

**Date:** 2026-06-16
**Source spec:** `Podium Website Improvements v1.docx.pdf` (Website Improvement Specification v1.1)
**Status:** Approved architecture — ready for implementation planning

---

## 1. Purpose & Scope

Execute every improvement in the v1 Website Improvement Specification across all user roles,
using a large fleet of parallel agents, organised into teams and subteams, running as a single
fully-autonomous workflow with no human gates mid-run.

**Decisions locked with the user:**

| Decision | Choice |
|---|---|
| Team & Agent flows (currently empty route folders, schema-only) | **Build from scratch** in this run |
| Execution autonomy | **Fully autonomous run-to-completion** — approve once, report at end |
| Colour palette (spec §10.1 marks it TBD) | **Token-first with a placeholder palette** — real palette is a later one-file swap |
| Priority cut | **Everything** — Critical + High + Medium in one run |

**Hard constraints (from the user):**

1. **Context discipline** — no single agent's working set may exceed ~50% of its context window;
   quality degrades past that point.
2. **Massive parallelism** — organised into teams and subteams.
3. **No idle phases** — no human-gated phase transitions. The only ordering permitted is technical
   and automated.
4. **High accuracy** — verified work, tests updated, type-check/lint/e2e clean.

---

## 2. Codebase Baseline (as found)

- **Built:** Athlete flow (6-step onboarding wizard, profile preview, settings, discovery, messages,
  requests, saved, dashboard) and Brand flow (4-step onboarding, subscription, discovery, listings,
  messages, payments, settings, dashboard).
- **Empty placeholders (schema exists, no UI):** `app/(team)/`, `app/(agent)/`, `app/(admin)/`.
- **Missing shared primitives:** file upload, image cropper, searchable combobox, character counter,
  slider, popover, card-select tiles. Card / Badge / Skeleton / Progress / Toast (sonner) exist.
- **Theme:** Tailwind 4 + oklch CSS variables, currently greyscale; fonts are **Geist** (spec wants
  **Syne + DM Sans**). No spacing/type scale documented.
- **Empty libs:** `lib/storage/`, `lib/realtime/`, `lib/notifications/` (gitkeep only).
- **Data layer:** `lib/supabase/{auth,profiles,discovery,messaging,deals,payments,notifications,admin}.ts`;
  `lib/stripe/index.ts`. Schema in 9 migrations with comprehensive enums.
- **Tests:** ~333 Vitest files (co-located) + 10 Playwright specs in `e2e/`.

**Implication:** Spec §5 (Team) and §6 (Agent) are net-new builds, not edits. Many spec items across
every role block on shared primitives that do not yet exist.

---

## 3. Orchestration Architecture (Approach A)

**One autonomous Workflow · shared working tree · disjoint-file ownership · dependency-gated fan-out.**

A single background workflow script encodes the dependency graph. Agents run concurrently against the
same working tree. Collision-freedom comes not from isolation but from **disjoint file ownership**: no
two concurrently-runnable tasks may own the same file. Leaf tasks are gated only on the *specific*
foundation outputs they consume, never on a whole "phase", so a task begins the instant its real
prerequisites land.

Rejected alternatives: **worktree-per-pod + merge agent** (merge overhead on shared files with no
benefit once ownership is disjoint; reserve worktrees only for pods that must mutate the same file),
and **manual wave dispatch** (orchestrator holds all context → violates the 50% rule and reintroduces
human idle between waves).

### 3.1 The single-owner rule (collision-avoidance mechanism)

| Owner | Exclusively owns |
|---|---|
| **Track A (Design System)** | `components/ui/`, `app/globals.css`, `app/layout.tsx`, `components/layout/` |
| **Track B (Data Foundation)** | `supabase/`, `types/`, `lib/` |
| **Each leaf pod** | Its own route segment + role component folder (disjoint slice) |

Leaf agents **consume** Track A primitives and Track B queries; they never edit a file in
`components/ui/` or `supabase/`. This rule is the load-bearing invariant of the whole design.

### 3.2 Context discipline (enforcing <50% per agent)

- Every agent receives a **narrow brief**: only the relevant spec excerpt, its exact owned file list
  (typically 1–5 files), which tokens/primitives to import, and acceptance criteria — never the whole
  spec or whole codebase.
- Agents return a **structured summary** (files touched, status, follow-ups), never file dumps.
- Mega-features are **pre-split** so no agent owns an oversized surface (e.g. Athlete Settings'
  8 sections become 3 pods).
- The orchestrator holds only the DAG + structured results, never file contents.

### 3.3 No idle phases

The workflow self-sequences. Foundation-first ordering is automated (minutes of work), not a human
gate. The user approves once and is not in the loop again until the final report. pipeline()/DAG
gating — not barriers — means a leaf starts as soon as its specific dependency resolves, not when an
entire stage completes.

### 3.4 Quality model (per CLAUDE.md)

- **TDD:** each pod writes/updates its co-located Vitest tests alongside implementation.
- **Per-pod self-verify:** `type-check` + `lint` + the pod's own tests must pass before it reports done.
- **Migrations precede code** (Supabase rule); **RLS on every new table**.
- **Final integration agent:** runs full `npm run check` + Playwright e2e and fixes cross-pod breakage.

---

## 4. Team Structure

```
Workflow (autonomous orchestrator — holds DAG + structured results only)
├── Track A — Design System        (owns components/ui/, globals.css, layout, components/layout/)
├── Track B — Data Foundation       (owns supabase/, types/, lib/)
├── Pod: Athlete                    (owns app/(athlete)/, components/athlete/)
├── Pod: Brand                      (owns app/(brand)/, components/brand/)
├── Pod: Team        [net-new]      (owns app/(team)/, components/team/)
├── Pod: Agent       [net-new]      (owns app/(agent)/, components/agent/)
├── Pod: Messaging                  (owns components/messaging/, role messages routes)
├── Pod: Global rollout             (owns template.tsx files, cross-cutting application)
└── Final Integration & Verification
```

---

## 5. Work-Breakdown Structure (≈50 tasks with dependency edges)

Notation: `Tn ← [deps]` means task `Tn` may start once `deps` are done. No-dep tasks start at t=0.

### Track A — Design System (all start at t=0, internally parallel)
- **A1** Tokens & theme: Syne+DM Sans, 4/8/16/32/64 spacing scale, 3-size type scale, placeholder
  semantic colour tokens (primary/accent/neutral×2/semantic/text tiers), radius, soft-shadow,
  page background, `prefers-reduced-motion` base. *(spec §2.1–2.3, §10.1)*
- **A2** Searchable combobox: type-to-filter, full ISO-3166 list + flag emoji, default UK; reusable for
  sport and university autocomplete. *(§3A.1)*
- **A3** Upload + image cropper: file picker/camera, JPEG/PNG/HEIC, min/max constraints, inline cropper
  with configurable aspect (1:1 avatar, square logo, cover). *(§3A.2, §4A.1)*
- **A4** Marketplace Card: image-led (configurable 60–70% height), name/category, one stat, tag row,
  single CTA, saved icon top-right, hover lift (translateY −2px, shadow ramp, 150ms). *(§2.4, §10.2.1)*
- **A5** Badge/chip system: level pill, colour-coded availability (green/amber/red), verified
  (blue/grey), low-opacity seeking tags. *(§2.4, §3B.1)*
- **A6** Card-select tiles: icon+label tiles, single/multi, highlight-on-select, max-N with error.
  *(§3A.6, §4A.1, §5A.2)*
- **A7** Character counter + Slider + small form atoms. *(§4A.1, §3C visibility)*
- **A8** Skeleton loaders (card-shaped, layout-matched) + Empty-state component + progressive
  image/blur-placeholder. *(§2.6, §10.2.3, §10.3.3)*
- **A9** Page-transition system: cross-fade for top-level nav, fade+8px slide for detail entry,
  scroll-preserving back, wizard slide, modal/bottom-sheet, toast, reduced-motion fallback. *(§10.3)*
- **A10** Shell components: nav shell (4 top-level + persistent role CTA, mobile bottom nav,
  breadcrumbs), settings two-column shell, stat-tile/metrics strip, hero-with-floating-panel.
  *(§2.5, §10.2.2, §10.2.3)*
- **A11** Form-validation standard (inline-on-blur hook, field-specific messages, asterisk + key,
  scroll-to-first-error, success state) + accessibility baseline (visible labels, focus, alt text,
  colour-never-alone). *(§9.3, §9.4)*

### Track B — Data Foundation (B1–B6 start at t=0; serialise into B7)
- **B1** Migration: athlete level expansion (8 levels) + secondary fields (university team, highest
  level, academy/club, national team) + NIL/seeking enum (10 types). *(§3A.3, §3A.6)*
- **B2** Migration: athlete media columns (profile photo, action photos, highlight videos) +
  availability enum display-label audit across all surfaces. *(§3A.2, §3A.4, §3A.5)*
- **B3** Migration: settings expansion — notification matrix, quiet hours, email digest, marketing
  opt-in, visibility/discovery, location precision, pause-matches, currency. *(§3C.2/3/4)*
- **B4** Migration: privacy/security — 2FA secret, active sessions, login history, data-export requests,
  cookie prefs. *(§3C.4, §3C.7)*
- **B5** Migration: payments/financial — athlete bank/Stripe-Connect, payment methods, brand seats,
  billing-history view. *(§3C.5, §4C.1)*
- **B6** Migration: Team build-out columns (media pack, annual sponsorship target, fan reach),
  Agent verification/commission, multi-administrator table. *(§5, §6)*
- **B7** Regenerate `types/database.ts` (once) + RLS policies for all new tables. `← [B1,B2,B3,B4,B5,B6]`
- **B8** `lib/storage` presigned-URL helpers + Supabase Storage bucket setup. *(§4A.1, upload rule)*
- **B9** `lib/supabase` query additions (settings, sessions, data export, seats, billing, team, agent).
  `← [B7]`
- **B10** `lib/realtime` (typing indicator, read receipts) + `lib/notifications` scaffolding. *(§7.2)*

### Pod: Athlete `← [A*, B*]` per-task
- **AT1** Onboarding Step 1: country dropdown + mandatory photo upload + two-column layout.
  `← [A2,A3,A11,B2]`
- **AT2** Onboarding Step 2: level expansion + conditional secondary fields. `← [A2,B1]`
- **AT3** Onboarding Step 4: availability clean labels + inline date picker. `← [B2,A11]`
- **AT4** Onboarding Step 6: **fix "Step 6 of 5 / 120%" counter bug** + NIL/seeking card-select.
  `← [A6,B1]`
- **AT5** Profile summary review card (all required elements, per-section Edit jump-back).
  `← [A4,A5,AT1,AT2,AT3,AT4]`
- **AT6** Settings — Profile + Visibility/Discovery sections. `← [A10,A7,B3]`
- **AT7** Settings — Notifications + Privacy/Data sections. `← [A10,B3,B4]`
- **AT8** Settings — Payments + Representation + Security + Account-Management sections.
  `← [A10,B4,B5]`
- **AT9** Discovery feed: Airbnb grid (3/2/1 cols), sticky search, filter chips, sort, results count,
  View CTA → full profile → connection request (300-char min). `← [A4,A8,A11]`
- **AT10** Athlete profile page richness: full-bleed hero + floating panel, stats block, masonry
  gallery, social preview strip, seeking-tags section. `← [A10,A4,A5]`

### Pod: Brand
- **BR1** Onboarding visuals: prominent logo + mandatory cover upload, industry "Other" free-text,
  description char-counter + hints, card-select "looking for", sport chips max-5. `← [A3,A6,A7,A11]`
- **BR2** Subscription selection UI: side-by-side comparison cards, "Most Popular" Pro, tick/cross
  feature matrix, trial-as-headline, comparison table, mobile stack. `← [A6,lib/stripe]`
- **BR3** Discovery athlete cards + filter panel + shortlist + tier-based upgrade prompt banner.
  `← [A4,A5,A8]`
- **BR4** Settings: listings management (create/edit/pause/close/**duplicate**), seat management,
  billing history (PDF invoices), failed-payment banner, upgrade/downgrade timing, campaign-stats
  summary. `← [A10,B5,lib/stripe]`
- **BR5** Dashboard metrics strip + designed empty states. `← [A10,A8]`

### Pod: Team `[net-new]`
- **TM1** Team profile creation wizard: identity, mandatory logo + cover (preview), searchable sport,
  expanded level list, year founded, bio counter. `← [A2,A3,A7,A11,B6]`
- **TM2** Sponsorship needs (card-select tiles, "Annual Sponsorship Target" + helper, brief-PDF upload
  with metadata preview) + "what team offers" two-column icon checklist + media-pack toggle.
  `← [A6,A3,B6,B8]`
- **TM3** Team settings: multi-administrator table (roles, resend invite, remove), visibility/privacy,
  fan-base reach quick-edit. `← [A10,B6]`
- **TM4** Team dashboard + discovery presence + nav wiring into route group. `← [A10,A4]`

### Pod: Agent `[net-new]`
- **AG1** Agent profile + verification badge prominence (grey unverified / blue verified) + "Apply for
  Verification" CTA. `← [A5,B6]`
- **AG2** Agent dashboard: client-management table, deal-pipeline view (by stage), pending-actions
  badge, quick actions. `← [A10,A4,B6]`
- **AG3** Agent settings + commission-disclosure explainer + nav wiring. `← [A10,B6]`

### Pod: Messaging
- **MS1** Inbox: conversation list (avatar/name/preview/timestamp/unread), search, sort, unread
  highlight + left border, archive (swipe/right-click). `← [A5,B10]`
- **MS2** Chat view: bubble layout, tap-to-reveal timestamps, read receipts (single/double tick),
  typing indicator, inline proposal cards (Accept/Counter/Decline), payment-confirmation cards, file
  tiles. `← [B10,A4]`
- **MS3** Mandatory-proposal brand UX: replace free-text input with "Send a Proposal" CTA until first
  proposal sent; "Create Proposal" modal/slide-up; explanatory text. `← [components/brand/proposal-form]`

### Pod: Global rollout
- **GL1** Apply page-transition system app-wide (`template.tsx` per route group, scale-on-tap origin,
  scroll-position preservation). `← [A9]`
- **GL2** Perceived performance: optimistic UI, prefetch-on-hover (300ms), route-level code-splitting
  (<200kb initial gzipped), progressive/WebP images. `← [A8]`
- **GL3** Navigation rollout across all role shells + breadcrumbs + mobile bottom nav. `← [A10]`
- **GL4** Empty-state + skeleton integration across every grid/list. `← [A8]`
- **GL5** Whitespace/spacing/typography audit pass per role (margins, card gaps, contrast WCAG AA).
  `← [A1]`

### Final
- **VF** Integration & verification: full `npm run check` (test + type-check + lint) + Playwright e2e
  across all flows; fix cross-pod breakage; produce final report. `← [all]`

---

## 6. Out of Scope / Deferred

- **Final colour palette** — spec §10.1 defers it to a separate brand exercise (Appendix A). This run
  ships a token-architected **placeholder** palette; swapping the real one is a single-file token edit.
- **Dark mode** — spec §10.1 explicitly defers. Light-mode only; do not build dark-mode infrastructure.
- **Admin flow** (`app/(admin)/`) — not in the improvement spec; remains a placeholder.

---

## 7. Acceptance Criteria (run-level)

1. Every Critical/High/Medium item in the source spec is implemented and traceable to a WBS task.
2. Team and Agent flows exist and are navigable end-to-end.
3. All shared UI conforms to the standardized primitives in Track A (no bespoke one-off cards/badges).
4. `npm run check` passes; Playwright e2e passes; no `any` without a justifying comment.
5. Every new table has an RLS policy; every schema change has a migration committed before its code.
6. The "Step 6 of 5 / 120%" counter bug and the broken availability ENUM label are fixed and verified.
