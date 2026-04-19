# Podium — Claude Development Harness Design
**Date:** 2026-04-19
**Scope:** CLAUDE.md + workflow harness for the Podium athlete-sponsor marketplace platform

---

## 1. Platform Context

Podium is a web-based marketplace matching athletes and teams to brands and sponsors — Airbnb-style browse by default, optional Tinder-style swipe mode. Athletes/teams list for free; brands pay a subscription. Deal flow: connection request → messaging → structured proposal → counter-proposal loop → e-signature → Stripe payment.

Four user roles: Athlete, Team, Brand/Sponsor, Agent. Plus a separate Admin panel.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| Database | Supabase (Postgres + Auth + Storage + Realtime) |
| Styling | Tailwind CSS + shadcn/ui |
| Payments | Stripe (brand subscriptions + athlete payouts) |
| Unit/integration tests | Vitest |
| E2E tests | Playwright |
| Deployment | Vercel |

---

## 3. Architecture

### Folder Structure

```
app/
  (public)/          → landing page, auth flows (no auth required)
  (athlete)/         → athlete dashboard, profile wizard, discovery
  (team)/            → team dashboard, profile wizard, discovery
  (brand)/           → brand dashboard, listings, search, subscription
  (agent)/           → agent dashboard, client management
  (admin)/           → admin panel — separate auth + mandatory 2FA
  api/
    webhooks/        → /stripe, /esign — HMAC-verified handlers only
    cron/            → /gdpr-purge, /chat-clear, /guardian-expiry
    upload/          → presigned URL generation (no file streaming)

components/          → pure UI components, no data fetching
lib/
  supabase/          → all DB queries (server + client helpers)
  stripe/            → all subscription + payment logic
  storage/           → presigned upload helpers
  realtime/          → Supabase Realtime channel setup
  notifications/     → push + email notification dispatch
types/               → all shared TypeScript types
middleware.ts        → auth + role-based route protection
```

### Layer Rules (hard — no exceptions)

- No Supabase calls outside `lib/supabase/`
- No Stripe calls outside `lib/stripe/`
- Server Components fetch data; `"use client"` only for interactivity
- Webhook handlers must verify HMAC signatures before any processing
- Large file uploads (photos, videos) → presigned URL only, never streamed through Next.js route handlers (Vercel 4.5MB body limit)
- Every new DB table requires an RLS policy before code that depends on it
- Every schema change → migration file in `supabase/migrations/` first, code second

### Background Jobs (Vercel Cron → `/api/cron/`)

| Job | Trigger | Purpose |
|---|---|---|
| `gdpr-purge` | Daily | Delete accounts past 14-day grace period |
| `chat-clear` | Daily | Auto-clear chats per user retention setting |
| `guardian-expiry` | Daily | Purge partial under-18 profiles after 30 days inactivity |
| `subscription-grace` | Daily | Pause brand accounts after 72hr payment failure |
| `u18-birthday` | Daily | Transfer full control on athlete's 18th birthday |

DB-level cleanup (bulk deletes, soft-delete sweeps) via Supabase `pg_cron`.

### Admin Zone

- Route group: `app/(admin)/`
- Completely separate middleware from main app
- Email + password auth only (no OAuth)
- Mandatory 2FA via authenticator app
- 30-minute idle session timeout
- All admin actions written to immutable audit log

---

## 4. CLAUDE.md

≤120 lines. Contains:

1. **Stack block** — pinned versions
2. **Architecture rules** — the layer boundaries above as hard rules
3. **Task routing table** — maps intent to slash command automatically
4. **Bayesian confidence protocol** — P ≥ 95% before marking done; logged to `docs/claude/confidence-log.md`
5. **Session protocol** — check `docs/claude/handoff.md` on start; `gsd:resume-work` if found; `gsd:pause-work` at 60% context
6. **Superpowers wiring** — explicit table of trigger → skill

### Task Routing Table

| User says... | Command |
|---|---|
| New feature / new page / new flow | `/new-feature` |
| Bug / wrong behaviour | `/fix-bug` |
| Schema change / new table / RLS | `/new-migration` |
| Missing tests | `/add-tests` |
| Stripe or payment work | `/stripe-feature` |
| Ready to deploy | `/deploy` |
| Autonomous iteration needed | `/ralph` |

---

## 5. Slash Commands (`.claude/commands/`)

### `/new-feature`
1. Invoke `superpowers:test-driven-development`
2. Read all relevant existing files before touching anything
3. Write failing Vitest unit tests first
4. Implement until tests pass
5. Write Playwright E2E test covering the user flow
6. Run `npm run lint` and `npm run type-check` — fix all issues
7. Invoke `superpowers:requesting-code-review`
8. Apply confidence protocol (≥95% before committing)
9. Commit with conventional commit message

### `/fix-bug`
1. Invoke `superpowers:systematic-debugging`
2. Identify root cause — do not fix symptoms
3. Write failing test that reproduces the bug
4. Fix until test passes
5. Run full test suite — confirm no regressions
6. Run `npm run lint` and `npm run type-check`
7. Apply confidence protocol
8. Append lesson to `docs/claude/lessons.md`
9. Commit

### `/new-migration`
1. Read all existing files in `supabase/migrations/` — never assume schema
2. Write migration SQL
3. Create timestamped file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
4. Write corresponding RLS policy
5. Update `docs/claude/architecture.md` if data flow is affected
6. Apply confidence protocol
7. Commit migration file before any code that depends on it

### `/add-tests`
1. Read the target file completely
2. Identify all untested paths (functions, edge cases, error states)
3. Write Vitest unit tests + Playwright E2E where the path involves a user flow
4. All must pass: `npm run test`
5. Apply confidence protocol
6. Commit

### `/stripe-feature`
1. Same steps as `/new-feature`
2. Additionally: verify HMAC signature in any webhook handler
3. Use idempotency keys on all Stripe API calls
4. Test both payment success and failure scenarios in Playwright
5. Test subscription upgrade, downgrade, and cancellation paths

### `/deploy`
1. Confirm all tests pass: `npm run test`
2. Confirm type-check clean: `npm run type-check`
3. Confirm lint clean: `npm run lint`
4. Invoke `superpowers:finishing-a-development-branch`
5. Push to Vercel

### `/ralph`
- Enter Ralph autonomous loop
- Stop condition: `npm run test && npm run type-check && npm run lint && npx playwright test --project=chromium`
- All four must exit 0
- Max iterations: 20 for features, 15 for bugs
- On max reached without passing: write BLOCKED report to `docs/claude/handoff.md` and exit

---

## 6. Claude Code Hooks (`.claude/settings.json`)

### PostToolUse — after every Write or Edit
- `prettier --write` on the modified file
- `next lint --file <path>` — errors to stderr; Claude must fix before continuing
- `npx tsc --noEmit` — flag type errors immediately

### PreToolUse — before every Write or Edit
- Block edits to `.env` / `.env.local` — exit code 2: "Never edit .env directly — use environment config pattern"
- If editing a file in `lib/supabase/` or `types/`: remind (exit 0) if no migration file exists with today's date: "Editing DB layer — if this involves a schema change, run /new-migration first"
- If editing a non-test `.ts` / `.tsx` file: check for a counterpart `*.test.ts` — remind (exit 0) if missing: "No test file found — remember to create one"
- If editing a file in `app/api/webhooks/`: warn if HMAC verification pattern is absent

### Stop Hook (Ralph Wiggum)
- Stop condition: `npm run test && npm run type-check && npm run lint && npx playwright test --project=chromium`
- Max 20 iterations (features) / 15 iterations (bugs)
- Output `TASK_COMPLETE` on success
- Output `BLOCKED` + write `docs/claude/handoff.md` on max iterations reached

---

## 7. Memory Docs (`docs/claude/`)

| File | Contents |
|---|---|
| `architecture.md` | Layer diagram, route group map, data flow, webhook flow, cron job inventory |
| `patterns.md` | How Server Components fetch, how Realtime subscriptions are set up, how Supabase queries are written, how Stripe webhooks are verified, how presigned uploads work |
| `lessons.md` | Seeded with 5 starter lessons from spec analysis |
| `known-issues.md` | Empty at start — populated as work progresses |
| `testing.md` | Vitest strategy (unit/integration), Playwright strategy (E2E flows), local Supabase setup, Stripe CLI local testing |
| `confidence-log.md` | Empty with header — one line per completed task |
| `handoff.md` | Created by `gsd:pause-work`, consumed by `gsd:resume-work` |

### Starter lessons (seeded in `lessons.md`)
1. Always verify webhook HMAC before processing — silent failure here means fraudulent events get processed
2. Never expose Supabase service role key to client components — use only in Server Components and route handlers
3. All under-18 athlete flows require guardian check before any deal action — missing this is a legal liability
4. RLS policy must be written before any code queries the new table — table without RLS is a data leak
5. Presigned URLs expire — generate them at request time, never cache or store them

---

## 8. Testing Strategy

### Unit / Integration (Vitest)
- All functions in `lib/` get unit tests
- Supabase queries tested against local Supabase instance (`supabase start`)
- Stripe logic tested with Stripe test mode keys + `stripe listen --forward-to localhost`
- Test file location: co-located (`lib/supabase/profiles.test.ts` next to `lib/supabase/profiles.ts`)

### E2E (Playwright)
- Critical flows tested: auth (sign-up → verify → role select), marketplace browse + filter, connection request + accept, proposal send + counter + accept, e-signature flow, Stripe payment
- Runs against local Next.js dev server
- Chromium only during development; full browser matrix before major releases
- Test files in `e2e/` directory

### Local test environment
```bash
supabase start          # local Postgres + Auth + Storage
stripe listen \
  --forward-to localhost:3000/api/webhooks/stripe
npm run dev             # Next.js dev server
npx playwright test     # E2E suite
```

---

## 9. No CI (For Now)

All testing is local. CI to be added post-MVP when core flows are stable.
