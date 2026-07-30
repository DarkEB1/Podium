# Podium

Athlete–sponsor marketplace platform. Athletes and teams list themselves; brands search, shortlist, and propose deals.

## Stack

Next.js 15 (App Router) · TypeScript strict · Supabase (auth + Postgres + Realtime) · Tailwind 4 · shadcn/ui · Stripe · Vitest · Playwright

## Prerequisites

- **Node.js** 20+ and **npm**
- **Docker Desktop** (running) — required for local Supabase
- **Supabase CLI** — `scoop install supabase` / `brew install supabase/tap/supabase`
- **Stripe CLI** (optional, only for testing payments) — `scoop install stripe` / `brew install stripe/stripe-cli/stripe`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (Docker must be running)
supabase start

# 3. Copy env template and fill in keys (see below)
cp .env.local.example .env.local

# 4. Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

New to the repo, or pulling `main` after a gap? Follow
[docs/setup-for-new-dev.md](docs/setup-for-new-dev.md) instead. It covers the
self-generated secrets and the migrations that recent fixes depend on, several of
which leave known bugs live if you skip them.

### Or: let Claude Code do it for you

Make sure Docker Desktop is running, then paste this into Claude Code from the project root:

> Set this project up for local development end-to-end. Do every step yourself — do not ask me to run commands. Verify each step before moving on.
>
> 1. Confirm Node 20+, npm, the Supabase CLI, and Docker Desktop are installed and that Docker is running. If anything is missing, tell me exactly what to install and stop.
> 2. Run `npm install`.
> 3. Run `supabase start` and wait for it to finish. If it's already running, run `supabase status` instead.
> 4. Read `supabase status --output env` to get `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`. Write `.env.local` with:
>     - `NEXT_PUBLIC_SUPABASE_URL` = API_URL
>     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ANON_KEY
>     - `SUPABASE_SERVICE_ROLE_KEY` = SERVICE_ROLE_KEY
>     - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
>     - Leave Stripe vars blank — payments are optional.
> 5. Verify the schema is applied: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt public.*"` should list tables including `users`, `athlete_profiles`, `brand_profiles`. If the list is empty, run `supabase db reset`.
> 6. Run `npm run check` to confirm type-check, lint, and unit tests pass.
> 7. Start `npm run dev` in the background and confirm it serves http://localhost:3000 (e.g. `curl -I http://localhost:3000`).
> 8. Report: the dev URL, Supabase Studio URL, Mailpit URL, and a one-line "ready" summary.

## Environment Variables

After `supabase start` finishes, run `supabase status --output env` and copy the output into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Stripe (optional — only for payments/subscriptions):**

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_TIER_1=price_...
STRIPE_PRICE_TIER_2=price_...
STRIPE_PRICE_TIER_3=price_...
```

The app boots without Stripe — only subscription checkout and payment intent endpoints will fail when invoked.

## Local Services

After `supabase start`:

| Service | URL |
|---|---|
| Next.js app | http://localhost:3000 |
| Supabase Studio (DB GUI) | http://127.0.0.1:54323 |
| Mailpit (catches all auth emails) | http://127.0.0.1:54324 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

> Email confirmation is disabled in `supabase/config.toml`, so signup activates the account immediately. Confirmation/password-reset emails (when triggered) appear in Mailpit.

## Testing Locally

**Sign up flow:**
1. Visit http://localhost:3000/auth
2. Sign up with any email + password (8+ chars, mixed case, number, symbol)
3. Pick a role on `/role-select` (athlete, team, brand, agent)
4. You'll be redirected into the role's onboarding wizard

**Stripe webhooks (only if testing payments):**
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.

## Test Suite

```bash
npm run check         # type-check + lint + vitest
npm run test          # vitest only
npm run type-check    # tsc --noEmit
npm run lint          # next lint
npx playwright test   # e2e (auto-starts dev server)
```

## Project Structure

```
app/                  # Next.js App Router pages and API routes
  (admin)/            # admin-only routes (separate middleware)
  (athlete)/          # athlete dashboard + onboarding
  (brand)/            # brand dashboard + onboarding
  (public)/           # auth, landing, etc.
  api/                # API route handlers
components/           # UI components (no data fetching)
lib/
  supabase/           # all DB queries (server + client)
  stripe/             # subscription + payment logic
  storage/            # presigned URL helpers
  realtime/           # Supabase Realtime channels
  notifications/      # email + push dispatch
middleware.ts         # auth + role-based route protection
supabase/migrations/  # SQL migrations (run via supabase db push)
e2e/                  # Playwright specs
types/database.ts     # Supabase-generated DB types
```

## Architecture Rules

- All Supabase calls live in `lib/supabase/` — never in components or route handlers directly
- All Stripe calls live in `lib/stripe/`
- Server Components fetch data; `"use client"` only for interactivity
- Webhook handlers must verify HMAC signatures before processing
- New DB tables require RLS policies in the same migration
- Stripe price IDs come from environment, not hard-coded
- See [`CLAUDE.md`](./CLAUDE.md) for the full rule set

## Resetting Local State

```bash
supabase db reset       # wipe DB + re-run migrations
supabase stop           # stop all local Supabase containers
rm -rf .next            # clear Next.js build cache (Windows: Remove-Item .next -Recurse -Force)
```

## Troubleshooting

- **Port 3000 in use** → `npm run dev` will pick the next free port, or kill the holder: `Get-Process node | Stop-Process -Force` (Windows) / `lsof -ti:3000 | xargs kill` (mac/linux)
- **`.next/trace` permission error** on Windows → another `node` process is holding the file; kill all node processes and `rm -rf .next`
- **"Invalid email or password" right after signup** → make sure middleware allows `/api/auth/signup` (the route must reach the handler, not get redirected to `/auth`)
- **Empty JSON response on form submit** → an API route threw an unhandled error; check the dev server terminal for the stack trace

## Specs

- [`docs/specs/full-spec.md`](./docs/specs/full-spec.md) — full product specification
- [`docs/specs/flows.md`](./docs/specs/flows.md) — product flows + data model
