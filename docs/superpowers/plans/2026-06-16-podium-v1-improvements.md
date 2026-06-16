# Podium v1 Improvements — Implementation Plan

> **For agentic workers:** This plan is executed by an autonomous **Workflow** orchestrator (script in
> §6), which dispatches one subagent per task. Each subagent receives the matching task brief from §4–§5
> as its prompt. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md: TDD, migrations before
> code, RLS on every new table, `npm run check` clean before any task reports done.

**Goal:** Implement every Critical/High/Medium item in the v1 Website Improvement Specification across all
roles — including net-new Team and Agent flows — via ~50 parallel agents organised into two foundation
tracks and six leaf pods, run as a single fully-autonomous workflow.

**Architecture:** One background Workflow encodes the dependency DAG. Agents run concurrently against a
shared working tree; collision-freedom comes from **disjoint file ownership** (Track A owns
`components/ui/`+theme; Track B owns `supabase/`+`types/`+`lib/`; each leaf pod owns its route group +
role component folder). Leaf tasks are gated only on the specific foundation outputs they consume, so they
start the instant those land — no phase barriers. Each task self-verifies; a final agent runs full
integration.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Supabase JS 2.x, Tailwind 4 + shadcn/ui
(Base Nova, `@base-ui/react` — **no `asChild`**), Stripe, Vitest (co-located), Playwright (`e2e/`).

**Source spec:** `Podium Website Improvements v1.docx.pdf`.
**Design doc:** `docs/superpowers/specs/2026-06-16-podium-v1-improvements-parallel-execution-design.md`.

---

## 0. Execution Rules (apply to every task / every agent)

1. **Stay under 50% context.** Read only the files in your task's "Files" list plus the contracts in §1.
   Do not read the whole spec or unrelated code. Return a structured summary, not file contents.
2. **Own only your files.** Never edit a file outside your task's ownership. If you need a change in
   `components/ui/`, `supabase/`, `types/`, or `lib/`, it is already provided by Track A/B — import it.
   If it is genuinely missing, report it as a follow-up; do not create it.
3. **TDD.** Write/adjust the co-located test first, watch it fail, implement, watch it pass.
4. **Verify before done.** Run `npm run type-check`, `npm run lint`, and the tests for your files. A task
   is not complete until all three are clean for your slice.
5. **Commit** your slice with a conventional message scoped to your task id (e.g. `feat(athlete): AT1 ...`).
6. **Placeholder palette / light mode only.** Use semantic tokens from §1.1; never hardcode hex; do not
   build dark-mode infrastructure (spec §10.1 defers it).
7. **Accessibility baseline always** (spec §9.4): visible labels, focus states, alt text, never colour-alone.

---

## 1. Shared Contracts (LOCKED — all pods depend on these exact names)

These are produced by Track A/B and consumed everywhere. They must match exactly. Any change requires
updating this section and is the orchestrator's call, not a pod's.

### 1.1 Design Tokens (A1 → `app/globals.css` via Tailwind 4 `@theme`)

```css
/* Fonts (next/font) — wired in app/layout.tsx */
--font-heading: var(--font-syne);     /* Syne */
--font-sans:    var(--font-dm-sans);  /* DM Sans */

/* Type scale — exactly three sizes (spec §2.2) */
--text-large:  1.5rem;   /* headings / names   -> Tailwind: text-large */
--text-medium: 1rem;     /* labels / subtext   -> text-medium */
--text-small:  0.8125rem;/* metadata/timestamps-> text-small */

/* Spacing scale (spec §2.1): use Tailwind 1=4 2=8 4=16 8=32 16=64. No arbitrary values. */

/* Colour — PLACEHOLDER palette, oklch, semantic (spec §2.3, §10.1) */
--background: oklch(0.985 0.004 95);  /* page: warm off-white */
--card:       oklch(1 0 0);           /* surface: white */
--primary:    oklch(0.55 0.18 255);   /* single action colour (placeholder blue) */
--accent:     oklch(0.72 0.15 45);    /* single accent (placeholder warm) */
--success:    oklch(0.62 0.17 150);
--warning:    oklch(0.78 0.16 80);
--destructive:oklch(0.58 0.22 27);    /* error */
--foreground: oklch(0.20 0 0);        /* primary text (near-black) */
--muted-foreground: oklch(0.52 0 0);  /* secondary/metadata (WCAG AA on card) */

/* Radius & shadow (spec §2.4) */
--radius: 0.75rem;                          /* 12px */
--shadow-card:       0 2px 8px rgba(0,0,0,0.08);
--shadow-card-hover: 0 4px 16px rgba(0,0,0,0.12);
```

### 1.2 Primitive component APIs (Track A → `components/ui/`)

```ts
// A2  components/ui/combobox.tsx
export function Combobox(props: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string | null; onChange: (v: string) => void;
  placeholder?: string; searchable?: boolean; allowCreate?: boolean;
}): JSX.Element;
// A2  components/ui/country-select.tsx  (full ISO-3166 + flag emoji, default "GB")
export function CountrySelect(props: { value: string | null; onChange: (iso: string) => void }): JSX.Element;

// A3  components/ui/image-upload.tsx  (file picker/camera, JPEG/PNG/HEIC, inline cropper)
export function ImageUpload(props: {
  value: string | null; onUploaded: (url: string) => void;
  aspect: number;            // 1 = square/avatar; pass 16/9 etc. for covers
  shape?: "circle" | "square";
  minPx?: number; maxMB?: number; label?: string; subtext?: string;
}): JSX.Element;             // uploads via lib/storage presigned URL (B8)

// A4  components/ui/marketplace-card.tsx
export function MarketplaceCard(props: {
  image: string; imageAlt: string; imageRatio?: number; // default 0.6
  title: string; subtitle?: string;
  stat?: { label: string; value: string };
  tags?: React.ReactNode; overlayBadges?: React.ReactNode;
  cta: { label: string; href?: string; onClick?: () => void };
  saved?: boolean; onToggleSave?: () => void; href?: string;
}): JSX.Element;

// A5  components/ui/status-badges.tsx
export function LevelChip(props: { level: string }): JSX.Element;          // pill, accent
export function AvailabilityBadge(props: { status: "available_now"|"available_from"|"not_available"; date?: string }): JSX.Element; // green/amber/red
export function VerifiedBadge(props: { verified: boolean }): JSX.Element;  // blue / grey "Unverified"
export function SeekingTag(props: { children: React.ReactNode }): JSX.Element; // low-opacity accent

// A6  components/ui/card-select.tsx
export function CardSelectGroup(props: {
  options: { value: string; label: string; description?: string; icon?: React.ReactNode }[];
  value: string[]; onChange: (v: string[]) => void; multiple?: boolean; max?: number;
  maxError?: string;
}): JSX.Element;

// A7  components/ui/character-counter.tsx + components/ui/slider.tsx
export function CharacterCounter(props: { value: string; max: number }): JSX.Element; // "243/600 characters"
export function Slider(props: { min: number; max: number; step?: number; value: number; onChange: (n: number) => void; format?: (n:number)=>string }): JSX.Element;

// A8  components/ui/card-skeleton.tsx, empty-state.tsx, blur-image.tsx
export function CardSkeleton(): JSX.Element;                 // matches MarketplaceCard proportions
export function EmptyState(props: { icon?: React.ReactNode; title: string; description?: string; action?: { label: string; href?: string; onClick?: () => void } }): JSX.Element;
export function BlurImage(props: { src: string; alt: string; blurDataURL?: string; className?: string }): JSX.Element;

// A10 components/layout/*
export function NavShell(props: { role: "athlete"|"brand"|"team"|"agent"; children: React.ReactNode }): JSX.Element; // 4 top-level items + persistent role CTA + mobile bottom nav + breadcrumbs
export function SettingsShell(props: { sections: { id: string; label: string }[]; active: string; children: React.ReactNode }): JSX.Element; // two-column
export function StatStrip(props: { stats: { label: string; value: string }[] }): JSX.Element;
export function HeroPanel(props: { image: string; alt: string; children: React.ReactNode }): JSX.Element; // full-bleed + floating panel

// A11 components/ui/required-key.tsx + lib/forms/validation.ts
export function RequiredKey(): JSX.Element;                  // "* Required field"
export function useFieldValidation(...): ...;                // inline-on-blur, field-specific messages, scroll-to-first-error
```

### 1.3 Page transitions (A9 → `components/layout/page-transition.tsx` + `template.tsx`)

`PageTransition` wraps route content. Cross-fade (200ms) for top-level nav; fade+8px-up for detail entry;
scroll-preserving back; modal/bottom-sheet scale-from-0.96; toast slide. All gated by
`prefers-reduced-motion` → opacity-only. Applied via one `template.tsx` per route group (GL1).

### 1.4 New data-layer signatures (Track B → `lib/supabase/*`, `lib/storage/*`)

```ts
// lib/storage/index.ts (B8)
export async function createUploadUrl(supabase, opts: { bucket: string; userId: string; ext: string }): Promise<{ uploadUrl: string; publicUrl: string }>;

// lib/supabase/settings.ts (B9)
export async function getSettings(supabase, userId): Promise<ProfileSettings>;
export async function updateSettings(supabase, userId, patch): Promise<ProfileSettings>;
export async function getActiveSessions(supabase, userId); export async function revokeSession(supabase, sessionId);
export async function getLoginHistory(supabase, userId);
export async function requestDataExport(supabase, userId);  // GDPR, 72h ZIP

// lib/supabase/teams.ts (B9, net-new)
export async function createTeamProfile(supabase, userId, data); export async function getTeamProfile(supabase, teamId);
export async function listTeamAdmins(supabase, teamId); export async function inviteTeamAdmin(...); export async function removeTeamAdmin(...);

// lib/supabase/agents.ts (B9, net-new)
export async function getAgentClients(supabase, agentId); export async function getAgentDealPipeline(supabase, agentId);
export async function applyForVerification(supabase, agentId);

// lib/supabase/payments.ts (extend, B9)
export async function getBillingHistory(supabase, brandId);  // invoices w/ pdf url
export async function listSeats(supabase, brandId); export async function removeSeat(...);

// lib/realtime/index.ts (B10): typingChannel(matchId), presenceChannel(...) ; messaging read-receipt helpers
```

### 1.5 Migration column/enum additions (Track B → `supabase/migrations/`)

- **B1**: extend `athlete_level` enum to 8 values (add `university_bucs`, `academy`, `national`); add
  `athlete_profiles` cols `university_team text`, `highest_level athlete_level`, `academy_club text`,
  `national_programme text`; new `seeking_type` enum (10 values) + `athlete_profiles.seeking seeking_type[]`.
- **B2**: `athlete_profiles` cols `profile_photo_url text`, `action_photos text[]`, `highlight_videos text[]`;
  no schema change for availability labels (display-only) — but a data audit task.
- **B3**: `profile_settings` cols for notification matrix (jsonb), `quiet_hours_start/end`, `email_digest`
  enum, `marketing_opt_in bool`, visibility/discovery cols, `location_precision` enum, `pause_matches bool`,
  `display_currency` enum.
- **B4**: `auth_2fa` (secret, enabled), `active_sessions` table, `login_history` table,
  `data_export_requests` table, `cookie_prefs jsonb`. RLS on all new tables.
- **B5**: `athlete_profiles.payout_*` (bank/stripe-connect), `payment_methods` table, `brand subscriptions`
  seat cols; billing-history sourced from Stripe + `payments`.
- **B6**: `team_profiles` cols (`media_pack_url`, `annual_sponsorship_target`, `fan_reach`); `agent_profiles`
  (`verification_status`, `commission_rate` already?), `team_admins` table (multi-admin w/ role enum).
- **B7**: `npm run` Supabase types regen → `types/database.ts`; RLS for every new table.

---

## 2. Why one plan, one workflow (decomposition note)

The spec's subsystems share the §1 contracts, so they are not independent and cannot be sequenced as
separate human-gated plans without violating the user's "no idle phases" requirement. The decomposition
unit here is the **task** (≈50 of them), each producing a self-contained, independently-testable change
owned by exactly one agent. The DAG (§5 deps + §6 script) sequences them automatically.

---

## 3. Standard per-task step template

Every task brief in §4–§5 is executed with these steps (the agent expands them with concrete code):

- [ ] **Step 1 — Read contracts + owned files.** Read §1 entries you depend on and only your "Files".
- [ ] **Step 2 — Write the failing test** (co-located `*.test.tsx`/`*.test.ts`) asserting the acceptance
      criteria. Run it; confirm it FAILS for the right reason.
- [ ] **Step 3 — Implement** the minimal change in owned files, importing §1 primitives/queries/tokens.
- [ ] **Step 4 — Run** `npm run type-check && npm run lint && npx vitest run <your test paths>`; all clean.
- [ ] **Step 5 — Commit** `git add <owned files> && git commit -m "<type>(<scope>): <task-id> <summary>"`.
- [ ] **Step 6 — Return** structured summary: `{ taskId, filesChanged[], testsAdded[], status, followUps[] }`.

---

## 4. Foundation Tasks

### Track A — Design System (owns `components/ui/`, `app/globals.css`, `app/layout.tsx`, `components/layout/`)

> A1–A11 have **no dependencies** and start at t=0. Each owns only the files it creates. They are the
> shared contract (§1.2); their public APIs are frozen as written.

- [ ] **A1 Tokens & theme** — Files: `app/globals.css`, `app/layout.tsx`, `tailwind` theme. Wire Syne +
  DM Sans via `next/font/google`; implement §1.1 tokens exactly; set page-bg≠card; add success/warning;
  enforce 3-size type scale + radius + shadows. Test: a Vitest snapshot/util asserting CSS vars resolve;
  a render test that `font-heading`/`font-sans` classes apply. Spec §2.1–2.3, §10.1.
- [ ] **A2 Combobox + CountrySelect** — Files: `components/ui/combobox.tsx`, `country-select.tsx`,
  `lib/data/countries.ts` (ISO-3166 + flag), `*.test.tsx`. Type-to-filter, scroll, default `GB`, flag in
  field after select. Spec §3A.1.
- [ ] **A3 ImageUpload + cropper** — Files: `components/ui/image-upload.tsx`, `*.test.tsx`. File/camera,
  JPEG/PNG/HEIC, min 500px, max 10MB, inline zoom/reposition cropper, configurable aspect/shape, circular
  thumbnail preview; uploads via `createUploadUrl` (B8). Spec §3A.2, §4A.1. **Dep: B8** for live upload;
  may mock storage in tests.
- [ ] **A4 MarketplaceCard** — Files: `components/ui/marketplace-card.tsx`, `*.test.tsx`. §1.2 API; image
  top 60–70%, name+subtitle, one stat, tag row, single CTA, saved icon, hover lift 150ms. Spec §2.4, §10.2.1.
- [ ] **A5 Status badges** — Files: `components/ui/status-badges.tsx`, `*.test.tsx`. LevelChip /
  AvailabilityBadge (green/amber/red + icon, never colour-alone) / VerifiedBadge (blue/grey) / SeekingTag.
  Spec §2.4, §3B.1, §6A.1, §9.4.
- [ ] **A6 CardSelectGroup** — Files: `components/ui/card-select.tsx`, `*.test.tsx`. Icon+label tiles,
  single/multi, highlight-on-select, `max` with `maxError`. Spec §3A.6, §4A.1, §5A.2.
- [ ] **A7 CharacterCounter + Slider** — Files: `components/ui/character-counter.tsx`,
  `components/ui/slider.tsx`, tests. Live "n/max characters"; range slider with `format`. Spec §4A.1, §3C.2.
- [ ] **A8 Skeleton/EmptyState/BlurImage** — Files: `components/ui/card-skeleton.tsx`, `empty-state.tsx`,
  `blur-image.tsx`, tests. Skeleton matches card proportions (no layout shift); blur-up placeholder. Spec
  §2.6, §10.2.3, §10.3.3.
- [ ] **A9 PageTransition system** — Files: `components/layout/page-transition.tsx`,
  `lib/motion/transitions.ts`, tests. §1.3 behaviours + reduced-motion. Spec §10.3.
- [ ] **A10 Shell components** — Files: `components/layout/nav-shell.tsx` (modify existing),
  `settings-shell.tsx`, `stat-strip.tsx`, `hero-panel.tsx`, tests. §1.2 APIs. Spec §2.5, §10.2.2, §10.2.3.
- [ ] **A11 Validation + a11y standard** — Files: `lib/forms/validation.ts`, `components/ui/required-key.tsx`,
  tests. Inline-on-blur, field-specific messages, scroll-to-first-error, success state, `RequiredKey`. Spec
  §9.3, §9.4.

### Track B — Data Foundation (owns `supabase/`, `types/`, `lib/`)

> B1–B6 author migration files (distinct filenames, safe to write in parallel) and **must precede code**.
> B7 regenerates types after all migrations. B8–B10 build lib helpers.

- [ ] **B1 Levels + NIL migration** — File: `supabase/migrations/2026..._athlete_levels_seeking.sql`. §1.5
  B1. RLS unchanged (existing table). Test: migration applies; enum/cols present (a `lib/supabase` query
  test or SQL assertion). Spec §3A.3, §3A.6.
- [ ] **B2 Athlete media migration + availability audit** — File: `2026..._athlete_media.sql` + grep audit
  task ensuring all ENUM dropdowns render display labels (`available_now → "Available Now"` etc.) across
  profile card, admin view, brand feed. Spec §3A.2, §3A.4.
- [ ] **B3 Settings migration** — File: `2026..._settings_expansion.sql`. §1.5 B3. Spec §3C.2/3/4.
- [ ] **B4 Privacy/security migration** — File: `2026..._privacy_security.sql`. New tables `active_sessions`,
  `login_history`, `data_export_requests` + `auth_2fa` + `cookie_prefs`. **RLS on each.** Spec §3C.4/7.
- [ ] **B5 Payments/financial migration** — File: `2026..._payments_financial.sql`. §1.5 B5. RLS on new
  tables. Spec §3C.5, §4C.1.
- [ ] **B6 Team/Agent build-out migration** — File: `2026..._team_agent_buildout.sql`. §1.5 B6. New
  `team_admins` table + RLS. Spec §5, §6.
- [ ] **B7 Types regen + RLS sweep** — `← B1–B6`. Files: `types/database.ts` (regenerated), any missing RLS
  policy files. Verify `npm run type-check` clean repo-wide after regen.
- [ ] **B8 Storage helpers** — Files: `lib/storage/index.ts`, Supabase bucket config, tests. `createUploadUrl`
  presigned-URL only (spec upload rule: never stream through Next.js). Spec §4A.1.
- [ ] **B9 Query additions** — `← B7`. Files: `lib/supabase/settings.ts`, `teams.ts`, `agents.ts`, extend
  `payments.ts`, tests. §1.4 signatures. RLS-respecting.
- [ ] **B10 Realtime/notifications scaffolding** — Files: `lib/realtime/index.ts`,
  `lib/notifications/index.ts`, tests. Typing channel + read-receipt helpers. Spec §7.2.

---

## 5. Leaf Pod Tasks (briefs + dependency edges)

> Each brief = **Owns** (files) · **Deps** · **Requirements (spec §)** · **Tests** · **Acceptance**.
> Agents follow §3 steps. Pods never edit Track A/B files.

### Pod: Athlete (owns `app/(athlete)/`, `components/athlete/`)
- [ ] **AT1** Onboarding Step 1. Owns `components/athlete/profile-wizard.tsx` (Step-1 section), step-1 page.
  Deps A2,A3,A11,B2. Req §3A.1–3A.2: CountrySelect (mandatory), ImageUpload avatar (mandatory, blocks
  advance, subtext), two-column desktop layout (§10.2.3). Tests: cannot advance without country+photo;
  validation messages render. Accept: both fields enforced, photo crops 1:1.
- [ ] **AT2** Onboarding Step 2 — level expansion. Owns wizard Step-2 section. Deps A2,B1. Req §3A.3: 8
  levels ascending; University/BUCS → university team autocomplete + "highest level played"; Academy →
  academy/club; National → programme. Tests: conditional fields appear per level. Accept: secondary fields
  persist.
- [ ] **AT3** Onboarding Step 4 — availability. Owns wizard Step-4 section. Deps B2,A11. Req §3A.4: clean
  labels; "Available From" reveals inline date picker. Tests: labels human-readable; date picker conditional.
- [ ] **AT4** Onboarding Step 6 — **counter bug + NIL**. Owns wizard Step-6 section + progress-indicator
  logic. Deps A6,B1. Req §3A.5: **fix "Step 6 of 5 / 120%"** — investigate adult(5)/u18(6) step-count
  off-by-one in `TOTAL_STEPS`/labels so display reads "Step N of N" / ≤100%; §3A.6: 10 NIL options as
  CardSelectGroup (multi) with subtitles, University/NIL-Collective option only for University/BUCS users.
  Tests: progress never exceeds 100%/total for both adult & u18 paths; NIL multi-select persists.
- [ ] **AT5** Profile summary review card. Owns `components/athlete/profile-preview.tsx`. Deps A4,A5,AT1–AT4.
  Req §3B.1: all listed elements in order, per-section Edit jump-back. Tests: all fields render; Edit routes
  to correct step. Accept: matches required element list.
- [ ] **AT6** Settings — Profile + Visibility/Discovery. Owns `components/athlete/settings-form.tsx`
  (sections 1–2) within SettingsShell. Deps A10,A7,B3. Req §3C-S1/S2 incl. completeness meter, visibility
  toggle w/ explanation, travel-radius slider, discovery-mode toggle. Tests: toggles persist via updateSettings.
- [ ] **AT7** Settings — Notifications + Privacy/Data. Owns settings sections 3–4. Deps A10,B3,B4. Req
  §3C-S3/S4: per-event Push/In-App/Email matrix, quiet hours, digest, marketing; visibility-per-section,
  location precision, block-list mgmt, **Download My Data**, cookie prefs. Tests: matrix writes jsonb;
  export request created.
- [ ] **AT8** Settings — Payments + Representation + Security + Account. Owns settings sections 5–8. Deps
  A10,B4,B5. Req §3C-S5/6/7/8: payment history/methods/currency, linked agent + revoke, guardian, 2FA QR,
  active sessions, login history, deactivate, delete (type DELETE, 14-day grace), under-18 transition banner.
  Tests: revoke confirms; delete requires "DELETE"; sessions list + sign-out.
- [ ] **AT9** Discovery feed. Owns `app/(athlete)/athlete/discover/page.tsx` + athlete discovery grid
  component. Deps A4,A8,A11. Req §3D.1: 3/2/1 grid, sticky search, filter chips + bottom-sheet, results
  count, sort, View CTA → full profile → connection request (300-char min). Tests: grid responsive; 300-char
  gate. Accept: skeleton on load, no spinner.
- [ ] **AT10** Athlete profile page richness. Owns athlete public profile page + section components. Deps
  A10,A4,A5. Req §10.2.2: full-bleed hero + floating panel, stats block, masonry gallery, social strip,
  seeking-tags. Tests: sections render with data; empty gallery → designed empty state.

### Pod: Brand (owns `app/(brand)/`, `components/brand/`)
- [ ] **BR1** Onboarding visuals. Owns `components/brand/brand-profile-form.tsx`. Deps A3,A6,A7,A11. Req
  §4A.1: logo upload top + preview, **mandatory cover**, industry "Other"→free-text, description
  CharacterCounter + hint, looking-for as CardSelectGroup, sport chips max-5 + error. Tests: cover required;
  6th sport errors. 
- [ ] **BR2** Subscription selection UI. Owns `components/brand/subscription-tiers.tsx`,
  `app/(brand)/brand/subscription/page.tsx`. Deps A6, `lib/stripe`. Req §4A.2: side-by-side comparison
  cards, "Most Popular" Pro w/ accent border, tick/cross matrix, 7-day-trial headline, comparison table,
  one CTA per tier, mobile stack. Tests: trial headline visible; one CTA/tier; Stripe checkout still wires.
- [ ] **BR3** Discovery athlete cards + filters + shortlist + tier prompt. Owns
  `components/brand/athlete-card.tsx`, `athletes-grid.tsx`, brand discover page. Deps A4,A5,A8. Req §4B.1–4B.2:
  standardized card, verified badge top-right, availability pill, "Responds quickly", filter panel + mobile
  count badge, shortlist (no request), non-intrusive upgrade banner. Tests: shortlist persists w/o request;
  upgrade banner non-blocking.
- [ ] **BR4** Brand settings. Owns `components/brand/brand-settings-form.tsx` + listings mgmt UI. Deps
  A10,B5,`lib/stripe`. Req §4C.1: listings create/edit/pause/close/**duplicate**, seat mgmt, billing
  history (PDF), failed-payment banner, upgrade/downgrade timing + price diff, campaign-stats summary.
  Tests: duplicate pre-fills; seat remove confirms.
- [ ] **BR5** Brand dashboard. Owns `app/(brand)/brand/dashboard/page.tsx`. Deps A10,A8. Req §10.2.3:
  metrics strip (Active Listings | Matches | Proposals | Deals), designed empty states. Tests: StatStrip
  renders; zero-state CTA shown.

### Pod: Team — net-new (owns `app/(team)/`, `components/team/`)
- [ ] **TM1** Team profile creation wizard. Owns `app/(team)/team/onboarding/**`, `components/team/team-profile-form.tsx`.
  Deps A2,A3,A7,A11,B6,B9. Req §5A.1: mandatory logo + cover (preview), searchable sport, expanded level
  list, year founded (1800–now), bio CharacterCounter (500). Tests: required fields; level list matches
  athlete enum. Accept: creates team_profile via createTeamProfile.
- [ ] **TM2** Sponsorship needs + offers. Owns team form sponsorship/offers steps. Deps A6,A3,B6,B8,B9. Req
  §5A.2–5A.3: CardSelectGroup for seeking, "Annual Sponsorship Target" + helper, brief-PDF upload w/
  metadata preview, two-column icon offers checklist, media-pack toggle→upload. Tests: PDF metadata shows;
  media-pack conditional.
- [ ] **TM3** Team settings. Owns `app/(team)/team/settings/**`, `components/team/team-settings-form.tsx`.
  Deps A10,B6,B9. Req §5B: multi-admin table (roles Primary/Standard/View, resend invite, remove + confirm),
  visibility/privacy, fan-reach quick-edit. Tests: admin role change; remove confirms.
- [ ] **TM4** Team dashboard + discovery presence + nav. Owns `app/(team)/team/dashboard/**`, team nav
  wiring. Deps A10,A4. Req: StatStrip dashboard, appears in discovery, NavShell role="team". Tests: nav
  renders 4 items + CTA.

### Pod: Agent — net-new (owns `app/(agent)/`, `components/agent/`)
- [ ] **AG1** Agent profile + verification. Owns `app/(agent)/agent/profile/**`, `components/agent/agent-profile-form.tsx`.
  Deps A5,B6,B9. Req §6A.1–6A.2: grey "Unverified"/blue verified badge, "Apply for Verification" CTA on
  dashboard, commission field + tooltip, athlete-facing commission explainer. Tests: badge state; apply
  triggers applyForVerification.
- [ ] **AG2** Agent dashboard. Owns `app/(agent)/agent/dashboard/**`, `components/agent/client-table.tsx`,
  `deal-pipeline.tsx`. Deps A10,A4,B6,B9. Req §6B.1: client table (photo/name/sport/level/active deals/last
  activity), quick actions, deal-pipeline by stage, pending-actions badge. Tests: pipeline groups by stage.
- [ ] **AG3** Agent settings + nav. Owns `app/(agent)/agent/settings/**`, agent nav wiring. Deps A10,B6,B9.
  Req: settings + NavShell role="agent". Tests: nav renders.

### Pod: Messaging (owns `components/messaging/`, role `messages` routes)
- [ ] **MS1** Inbox. Owns `components/messaging/match-list.tsx`. Deps A5,B10. Req §7.1: list (avatar/name/
  preview/timestamp/unread badge), search, sort (recent/oldest/unread), unread highlight + left border,
  archive (swipe mobile/right-click desktop, uses existing `match_status=archived`). Tests: search filters;
  archive removes from inbox.
- [ ] **MS2** Chat view. Owns `components/messaging/chat-window.tsx`, `message-bubble.tsx`,
  `proposal-card-message.tsx`. Deps B10,A4. Req §7.2: bubble layout (sender right/primary, receiver
  left/grey), tap-to-reveal timestamps, read receipts (single/double tick), typing indicator, inline
  proposal cards (Accept/Counter/Decline), payment-confirmation green card, file tiles. Tests: timestamp on
  tap only; proposal renders as card not text.
- [ ] **MS3** Mandatory-proposal brand UX. Owns brand chat entry wrapper (in `components/messaging/` or brand
  messages route — disjoint from MS2 file set). Deps `components/brand/proposal-form.tsx`. Req §7.3: on a
  brand's first open of a new match, replace free-text input with "Send a Proposal" CTA + explanatory text;
  "Create Proposal" opens modal/slide-up; free-text appears only after a proposal is sent. Tests: input
  hidden pre-proposal; visible after.

### Pod: Global rollout (owns `template.tsx` files + cross-cutting application; coordinates last)
- [ ] **GL1** Apply transitions app-wide. Owns one `template.tsx` per route group. Deps A9. Req §10.3:
  wire PageTransition, scale-on-tap origin, scroll-position preservation on back. Tests: reduced-motion →
  opacity-only.
- [ ] **GL2** Perceived performance. Owns next config + targeted hooks (no overlap with pod page logic).
  Deps A8. Req §10.3.3: optimistic UI helper, prefetch-on-hover (300ms), route code-splitting (<200kb
  initial gzipped — verify with build output), WebP/progressive images. Tests/verify: bundle budget check.
- [ ] **GL3** Navigation rollout. Owns shared nav config consumed by role shells (NavShell already built in
  A10; GL3 wires per-role items + breadcrumbs + mobile bottom nav). Deps A10. Req §2.5. **Coordinated after
  role pods create their routes** to avoid editing pod-owned layout files — GL3 owns only the nav config.
- [ ] **GL4** Empty-state + skeleton integration sweep. Owns a checklist pass adding `EmptyState`/`CardSkeleton`
  to any grid/list still missing them, editing only files not concurrently owned (orchestrator serialises
  GL4 after AT9/BR3/BR5/TM4/AG2). Deps A8 + those pods. Req §10.2.3, §2.6.
- [ ] **GL5** Whitespace/typography/contrast audit. Owns a per-role pass verifying margins (24px mobile/64px
  desktop), card gaps (16/12px), 3-size type scale, WCAG AA contrast — editing only files not concurrently
  owned (serialised after each role pod). Deps A1 + role pods. Req §2.1–2.2, §9.4.

### Final
- [ ] **VF** Integration & verification. Deps: ALL. Run `npm run check` (test + type-check + lint) +
  `npx playwright test`; fix cross-pod breakage; verify acceptance criteria §7 of the design doc; produce
  final report (coverage table: every spec item → task → status).

---

## 6. Workflow Orchestration Script

The autonomous run is launched via the **Workflow** tool with the script below. It encodes the §5 DAG,
streams tasks with `pipeline()`/dependency-gating (no phase barriers), keeps each agent's context narrow by
passing only that task's brief, and self-verifies per task. (The orchestrator passes each task its brief
text from this plan; agents read only their owned files + §1 contracts.)

```js
export const meta = {
  name: 'podium-v1-improvements',
  description: 'Autonomous parallel execution of Podium v1 UX/UI improvement spec across all roles',
  phases: [
    { title: 'Foundation', detail: 'Track A design system + Track B data foundation' },
    { title: 'Leaf pods', detail: 'Athlete/Brand/Team/Agent/Messaging features, dependency-gated' },
    { title: 'Global rollout', detail: 'Transitions, perf, nav, empty-states, audits' },
    { title: 'Integration', detail: 'Full check + e2e + coverage report' },
  ],
}

// Each entry: { id, brief, deps, owns }. brief = the §4/§5 task text (kept short, agent reads files itself).
const TASKS = args.tasks // the orchestrator injects the parsed task table (id, brief, deps) from §4–§5

const SUMMARY = {
  type: 'object',
  required: ['taskId', 'status', 'filesChanged'],
  properties: {
    taskId: { type: 'string' },
    status: { type: 'string', enum: ['done', 'blocked', 'partial'] },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
}

const done = new Map()                 // id -> summary
const ready = (t) => t.deps.every(d => done.get(d)?.status === 'done')

function runTask(t) {
  const phase = t.id.startsWith('A') || t.id.startsWith('B') ? 'Foundation'
    : t.id.startsWith('GL') ? 'Global rollout'
    : t.id === 'VF' ? 'Integration' : 'Leaf pods'
  return agent(
    `You are executing task ${t.id} of the Podium v1 plan.\n` +
    `OWN ONLY THESE FILES: ${t.owns}\n` +
    `Brief: ${t.brief}\n` +
    `Follow the §3 step template: TDD, import shared primitives/tokens/queries, ` +
    `run type-check+lint+your tests, commit, then return the structured summary. ` +
    `Stay under 50% context: read only your owned files and the contracts you depend on.`,
    { label: t.id, phase, schema: SUMMARY }
  ).then(s => { if (s) done.set(t.id, s); return s })
}

// Dependency-gated streaming: keep launching every task whose deps are satisfied,
// in waves, until all are done. No human gates, no phase barriers between A/B and leaves.
let remaining = TASKS.filter(t => t.id !== 'VF')
while (remaining.length) {
  const launchable = remaining.filter(ready)
  if (!launchable.length) { log('Waiting on in-flight deps...'); break } // safety: cycle/blocked guard
  remaining = remaining.filter(t => !launchable.includes(t))
  log(`Launching wave: ${launchable.map(t => t.id).join(', ')}`)
  await parallel(launchable.map(t => () => runTask(t)))  // barrier per wave; next wave unlocks freshly-ready tasks
}

// Final integration after everything else.
phase('Integration')
const vf = await agent(
  `Task VF: run \`npm run check\` and \`npx playwright test\`. Fix cross-pod breakage ` +
  `(you may edit any file to resolve integration failures). Produce a coverage report mapping ` +
  `every spec item to its task and status.`,
  { label: 'VF', phase: 'Integration', effort: 'high' }
)
return { tasks: [...done.values()], integration: vf }
```

> **Note on waves vs. pure streaming:** the loop uses a per-wave `parallel()` barrier for simplicity and
> safety (clean dependency snapshots). Because foundation tasks are small and fast, the brief wait between
> waves is automated — not a human gate — so it satisfies the "no idle phases" requirement. A future
> refinement could replace the wave barrier with a fully-streaming scheduler (launch each task the instant
> its deps resolve) if wall-clock matters more than simplicity.

---

## 7. Self-Review

**Spec coverage** — traced each spec section to a task: §2 global → A1,A4,A5,A8,A10,A11,GL5; §3A onboarding →
AT1–AT4; §3B summary → AT5; §3C settings → AT6–AT8; §3D discovery → AT9; §4A → BR1; §4A.2 subscription →
BR2; §4B → BR3; §4C → BR4; §5 team → TM1–TM4 (+B6); §6 agent → AG1–AG3 (+B6); §7 messaging → MS1–MS3; §9.3
validation → A11; §9.4 a11y → A5,A11,GL5; §10.1 colour → A1; §10.2 density → A4,A8,A10,AT10,BR5; §10.3
transitions/perf → A9,GL1,GL2. No uncovered section.

**Placeholder scan** — no TBD/TODO except the spec-mandated colour/dark-mode deferral (§0 rule 6); all task
briefs name exact owned files, deps, spec refs, and acceptance.

**Type consistency** — primitive prop names and query signatures used in §5 briefs match §1.2/§1.4 exactly
(e.g. `CardSelectGroup`, `CountrySelect`, `createUploadUrl`, `updateSettings`, `getBillingHistory`).

**Known follow-up flagged** — AT4 counter bug is scoped as fix-and-investigate (adult vs u18 `TOTAL_STEPS`).
GL3/GL4/GL5 are serialised after the role pods they touch to preserve disjoint-ownership (orchestrator
dependency edges enforce this).
