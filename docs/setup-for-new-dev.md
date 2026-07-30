# Setting up Podium on your machine

Written for a developer joining the repo at `main` = `625e286`. It covers the
first-time setup, and the extra steps needed because the latest round of fixes is
half schema: pull the code without applying the migrations and several bugs the
QA reports describe are still live on your machine.

`README.md` is the general quick start. This file is the ordered path plus the
parts the README does not know about yet.

---

## 1. Prerequisites

- Node.js 20+ and npm
- Docker Desktop, running (local Supabase needs it)
- Supabase CLI: `scoop install supabase` on Windows, `brew install supabase/tap/supabase` on macOS
- Stripe CLI, optional, only if you are working on payments

---

## 2. First-time setup

```bash
git clone https://github.com/DarkEB1/Podium.git
cd Podium
npm install

# Docker must be running. This starts Postgres, Auth, Storage and Mailpit,
# and applies every migration in supabase/migrations.
supabase start
```

Then write `.env.local`. `supabase status --output env` prints the three values
you need:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.local.example` documents every variable and where it comes from. Copy it
and fill in rather than writing the file from scratch:

```bash
cp .env.local.example .env.local
```

Everything is validated by `lib/env.ts` on first use, and a bad value fails fast
with one aggregated error listing all of them.

### Secrets you generate yourself

Four values need no account. Without them the features below fail closed, which
means they refuse to run rather than misbehave. `CRON_SECRET` matters most: with
it unset, **every** background job returns 401 and silently never runs.

```bash
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # TWO_FACTOR_ENCRYPTION_KEY   (must be exactly 64 hex chars)
openssl rand -hex 32   # ADMIN_2FA_COOKIE_SECRET
openssl rand -hex 32   # UNSUBSCRIBE_SECRET
```

No `openssl` on Windows? Use Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Web Push keys, also self-generated, only needed if you are working on
notifications:

```bash
npx web-push generate-vapid-keys
# public key  -> NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PUBLIC_KEY
# private key -> VAPID_PRIVATE_KEY
# VAPID_SUBJECT=mailto:you@example.com
```

### What needs a third-party account

All of these are optional locally and every one fails closed when unset, so the
app boots and works without them:

| Leave unset and... | Variables |
|---|---|
| No email is delivered; each send is recorded as `skipped` in `email_deliveries` | `RESEND_API_KEY`, `EMAIL_FROM` |
| Subscription checkout and payment intents fail when invoked; nothing else breaks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TIER_*` |
| Payout status never syncs; the Connect webhook returns 503 | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Each social provider shows "Coming soon" and its connect flow is disabled | `META_*`, `TIKTOK_*`, `X_*`, `GOOGLE_*`, `LINKEDIN_*` |

Finally:

```bash
npm run check   # type-check + lint + 2280 unit tests, all should pass
npm run dev
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit, catches all auth email | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

---

## 3. If you already had the repo

```bash
git checkout main
git pull
npm install

# Apply the new migrations. Locally, a reset is the clean option and wipes data:
supabase db reset
# Against a shared or remote database, push instead:
supabase db push
```

**Do not skip the migration step.** The last round of fixes is deliberately split
between code and schema, and the code half alone does nothing.

---

## 4. The five new migrations, and what stays broken without them

| Migration | Without it |
|---|---|
| `20260730000000_onboarding_completion` | Brands escape the onboarding wizard after step 1, and any team or agent profile created before the fix stays stranded in `draft`, permanently bounced back to onboarding |
| `20260730000100_brand_linkedin_optional` | Brand signup fails whenever LinkedIn is left blank, which the form calls optional |
| `20260730000200_send_proposal_unlocks_messaging` | `send_proposal` does not exist, so sending a proposal errors, and free-text chat never unlocks for any match |
| `20260730000300_profile_settings_bootstrap` | No user has a `profile_settings` row, so every transactional email throws while checking preferences and nothing is ever delivered |
| `20260730000400_exports_bucket` | The `exports` storage bucket does not exist, so every GDPR "download my data" request fails |

---

## 5. Confirm it actually worked

Four checks against the four fixes that need schema:

```bash
export DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# PowerShell: $env:DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

# 1. The proposal function exists (QA-1.4)
psql $DB -c "select proname from pg_proc where proname = 'send_proposal';"

# 2. Every user has a settings row (QA-1.5). Both counts must match.
psql $DB -c "select (select count(*) from public.users) as users,
                    (select count(*) from public.profile_settings) as settings;"

# 3. The exports bucket accepts JSON (QA-1.7)
psql $DB -c "select id, public, allowed_mime_types from storage.buckets where id = 'exports';"

# 4. Contract locking is wired (QA-1.6). After both parties sign a contract,
#    locked_at and retain_until are both set:
psql $DB -c "select status, locked_at, retain_until from public.contracts order by created_at desc limit 5;"
```

Then in the UI: sign up as a team, finish the single onboarding form, and confirm
you land on the team dashboard instead of being sent back to onboarding. That one
path was completely impassable before this round.

---

## 6. Working in this repo

`CLAUDE.md` holds the rules that matter and is short. The ones that bite first:

- No Supabase calls outside `lib/supabase/`, and no Stripe calls outside `lib/stripe/`
- Every schema change is a migration file first, then code. Never the dashboard.
- RLS policy on every new table, no exceptions
- `npm run check` clean before you call something done
- No `<Button asChild>`; use `<Link className={buttonVariants({ variant, size })}>`
- No em dashes in anything a user reads. `lib/copy/index.ts` is the microcopy source.

Test layout: Vitest specs sit next to their source (`lib/supabase/deals.test.ts`),
Playwright specs live in `e2e/`. Migrations have static SQL tests next to them,
so the suite runs without a live database.

---

## 7. What is still open

Read `comprehensive-qa-report1.md` in the repo root for the full picture. As of
`625e286` all eight of its criticals are fixed, plus the medium findings. Left
deliberately:

- **3.4**, the representation-accept endpoint takes `{ accept: true }` while
  connection requests and proposal responses take `{ action: "accept" }`. Worth
  normalising, not a bug.
- **Section 6** of the report lists what was never tested: per-endpoint rate
  limits, genuine concurrency, admin moderation beyond verification approval, the
  listing edit and pause lifecycle, blocking, chat attachments, and subscription
  changes against a real Stripe account. Chat attachments are testable now that
  messaging unlocks.
- Verification badges reflect an approved request, but no KYC provider is
  integrated, so approval is still a manual admin decision.
