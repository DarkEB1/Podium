# CLAUDE.md — Podium

## Stack
Next.js 15 (App Router) · TypeScript strict · Supabase JS 2.x · Tailwind 4 · shadcn/ui · Stripe · Vitest · Playwright
All commands via `npm run` — see `package.json` scripts

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

## Supabase Rules
- Schema change → migration file → `supabase db push` → then code. Never dashboard-only.
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
