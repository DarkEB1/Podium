# CLAUDE.md — Podium

## Stack
Next.js 15 (App Router) · TypeScript strict · Supabase JS 2.x · Tailwind 4 · shadcn/ui · Stripe · Vitest · Playwright
All commands via `npm run` — see `package.json` scripts

## Environments & Deployment (live since 2026-08-05)
| | Production | Staging / internal dev |
|---|---|---|
| Git branch | `main` | `staging` |
| URL | https://podiumsponsorship.com (alias podium-lyart.vercel.app) | podium-git-staging-podium6.vercel.app |
| Vercel env | Production | Preview |
| Supabase project | `podium` — ref `wchvidibjhjhchorjsup` (eu-west-2) | `podium-staging` — ref `cltvgjsmzujsrnmnfues` (eu-west-2) |
| Stripe | test mode for now; live-mode switch pending real prices | test mode, permanently |

- Vercel project `podium` on team `podium6`, **Hobby plan**. Once the GitHub repo is connected: push to `main` = production deploy, push to `staging` = preview deploy. Until then deploys are CLI-only, and the permission layer requires the human to run `vercel deploy --prod`.
- **`main` is live.** Do feature work on `staging` (or a branch off it); merge to `main` only after `npm run check` is green and the change was seen working on the staging URL.
- **Migrations**: never auto-applied by any deploy — see "Schema Changes" below for the mandatory sequence.
- **Secrets** live in `.env.local` (gitignored) and in Vercel env vars — never in committed files. Production and Preview have separate values; Preview's Supabase keys point at staging, and its 2FA/cron/unsubscribe secrets are distinct from production's on purpose.
- **Crons**: Hobby allows 2 daily cron slots. `/api/cron/daily` runs every job via `lib/cron/daily-jobs.ts`; a second slot re-runs data-export. A new cron job = new route + entry in `DAILY_CRON_JOBS`, NOT a new `vercel.json` schedule (`vercel.crons.test.ts` enforces this).
- **Email**: Resend, domain podiumsponsorship.com (region eu-west-1), sender `no-reply@podiumsponsorship.com`.
- **DNS**: Cloudflare (free) manages the zone; the domain registration itself is at Turbify under a coworker's account. Record inventory and rationale: `docs/dns-podiumsponsorship.md`. Don't change nameservers.
- **Stripe accounts**: the only real one is `acct_1U00dtRuiS086Bui` ("Podium"). Test-mode tier prices are £59/£149/£299 (Starter/Growth/Enterprise), each carrying `metadata.tier`. Live-mode prices pending per `docs/stripe-live-price-checklist.md`. Webhooks `/api/webhooks/stripe` + `/api/webhooks/stripe-connect` point at podium-lyart.vercel.app; signing secrets are in both Vercel envs.
- **Boundaries for agents**: never `vercel deploy --prod`, `db push` to production, or change Production env vars without the human explicitly asking; never create live-mode Stripe objects; sessionless routes (webhooks, guardian consent, cron) must stay in `PUBLIC_PATHS` in `middleware.ts` — they self-authenticate.

## Task Routing (applied automatically — no explicit command needed)
| User says... | Apply |
|---|---|
| New feature / page / flow | `/new-feature` |
| Bug / wrong behaviour | `/fix-bug` |
| Schema change / new table / RLS | `/new-migration` |
| Missing tests | `/add-tests` |
| Stripe / payment work | `/stripe-feature` |
| Ready to deploy | `/deploy` |
| Autonomous loop needed | `/ralph` |

When intent is ambiguous: state which command you are applying and why before starting.

## Architecture Rules
- No Supabase calls outside `lib/supabase/` — never in components or route handlers directly
- No Stripe calls outside `lib/stripe/`
- Server Components fetch data; `"use client"` only for interactivity, never for data access
- Webhook handlers must verify HMAC signatures before any processing
- Large file uploads → generate presigned URL in `app/api/upload/` only — never stream through Next.js
- Every new DB table → write RLS policy before any code queries it
- Every schema change → migration file in `supabase/migrations/` first, then code
- `app/(admin)/` has separate middleware — never share auth logic with main app
- No `<Button asChild>` — Button uses `@base-ui/react` (not Radix), which does not support `asChild`. Use `<Link className={buttonVariants({ variant, size })}>` from `@/components/ui/button` instead

## Layer Map
```
components/          → pure UI, no lib imports, no data fetching
lib/supabase/        → all DB queries (server + client helpers)
lib/stripe/          → all subscription and payment logic
lib/storage/         → presigned URL helpers only
lib/realtime/        → Supabase Realtime channel helpers
lib/notifications/   → email + push dispatch
app/api/webhooks/    → HMAC-verified event handlers
app/api/cron/        → background job handlers (Vercel Cron)
app/api/upload/      → presigned URL generation
middleware.ts        → auth + role-based route protection
```

## Schema Changes (Supabase) — mandatory sequence
Two databases exist; nothing migrates them automatically. Refs: production `wchvidibjhjhchorjsup` · staging `cltvgjsmzujsrnmnfues`. The resting state of `supabase link` is PRODUCTION, so a bare `npx supabase db push` hits the LIVE database — always check first: `cat supabase/.temp/project-ref`.

For every schema change, in this order:
1. Write the migration file in `supabase/migrations/` (never dashboard-only edits).
2. Apply to staging: `npx supabase link --project-ref cltvgjsmzujsrnmnfues` then `npx supabase db push`.
3. Build and test the code against staging (push branch → preview URL; Preview env talks to staging DB).
4. Apply to production BEFORE the code merges to `main`: `npx supabase link --project-ref wchvidibjhjhchorjsup` then `npx supabase db push`. Migrations therefore must be backward compatible with the code currently live.
5. Merge `staging` → `main` (code auto-deploys; schema is already in place).
6. Leave the link on production (step 4 does this; never leave it on staging).

DB passwords: `SUPABASE_DB_PASSWORD` (production) and `SUPABASE_STAGING_DB_PASSWORD` in `.env.local`; `db push` reads `SUPABASE_DB_PASSWORD` from the environment, so export the right one for the linked project (`SUPABASE_DB_PASSWORD="$SUPABASE_STAGING_DB_PASSWORD" npx supabase db push` for staging).

## Supabase Rules
- Schema change → migration file → staged rollout per "Schema Changes" above → then code. Never dashboard-only.
- RLS required on every new table — no exceptions
- Store DateTime as UTC ISO 8601 string
- Service role key: Server Components and route handlers only — never in `"use client"` files

## TypeScript
- Strict mode — no `any`. `as Type` requires a comment explaining why.
- DB types come from `types/database.ts` (Supabase-generated) — never inline
- All shared types in `types/` — component-specific types co-located with the component

## Testing
- Unit/integration: Vitest — test file co-located with source (`lib/supabase/profiles.test.ts`)
- E2E: Playwright in `e2e/` — one spec file per major user flow
- Before done: `npm run test` passing + `npm run type-check` clean + `npm run lint` clean
- Full check: `npm run check`

## Bayesian Protocol
State prior → gather evidence → state posterior → gate at ≥95% → log in `docs/claude/confidence-log.md`
- P ≥ 95%: proceed and mark complete
- P 70–94%: identify the specific gap, fix it, re-estimate
- P < 70%: stop and ask

## Session Protocol
1. **Start**: check `docs/claude/handoff.md` → if it exists, invoke `gsd:resume-work` before anything else
2. **Limit**: at 60% context usage → invoke `gsd:pause-work` → writes handoff state → close session

## Superpowers
| Trigger | Skill |
|---|---|
| Ambiguous or open-ended request | `superpowers:brainstorming` |
| New feature or significant code change | `superpowers:test-driven-development` |
| Bug or unexpected failure | `superpowers:systematic-debugging` |
| Multi-step task needing a plan | `superpowers:writing-plans` |
| Executing agreed plan | `superpowers:executing-plans` |
| Before commit to main | `superpowers:requesting-code-review` |
| Before merge | `superpowers:finishing-a-development-branch` |
| Parallel independent work | `superpowers:dispatching-parallel-agents` |

## Slash Commands
`/new-feature` `/fix-bug` `/new-migration` `/add-tests` `/stripe-feature` `/deploy` `/ralph`
Full workflows in `.claude/commands/`

## CLAUDE.md Maintenance
Rule violated twice → rewrite it or move it to `docs/claude/lessons.md`
Rule already followed without being stated → delete it
