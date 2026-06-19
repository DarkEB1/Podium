# Podium — Backend Completion Guide (Handoff)

**For:** a developer with live **Supabase** + **Stripe** access, working with a Claude Code agent.
**Branch:** `main` (everything below is already committed there).
**Goal:** finish the backend-dependent features that are currently **scaffolded/stubbed** — the UI, database schema, query layer, and tests already exist; what's missing is the "connect to real infrastructure" layer.

> **How to use this doc:** feed your agent the prompt in the README section at the bottom (or `docs/handoff/PROMPT.md`). It points the agent here. Build in the order given — each feature is self-contained and independently testable.

---

## 0. Ground rules (from `CLAUDE.md` — the agent MUST follow these)

- **No Supabase calls outside `lib/supabase/`** (or `lib/storage`, `lib/realtime`, `lib/notifications`). Never query Supabase directly in a component or route handler — add a function to the right `lib/` module and call it.
- **No Stripe calls outside `lib/stripe/`.**
- **Every new table gets an RLS policy in the same migration.** No exceptions.
- **Schema change → migration file in `supabase/migrations/` → `supabase db push` → then code.** Never dashboard-only schema edits.
- **Webhook handlers verify HMAC signatures before any processing** (see the existing `app/api/webhooks/stripe/route.ts` as the pattern).
- **Large uploads use presigned URLs from `lib/storage` only** — never stream file bodies through Next.js route handlers.
- **TypeScript strict, no `any`** (a cast needs a justifying comment). DB types come from `types/database.ts` (regenerate after each migration).
- **TDD + green gate:** co-locate Vitest tests; `npm run check` (test + type-check + lint) must pass before any task is "done."
- Store DateTime as UTC ISO-8601. Service-role key only in server code, never in `"use client"`.

After any migration: regenerate types (`npm run` the supabase types-gen script, or `supabase gen types typescript ... > types/database.ts`) and re-run `npm run type-check`.

---

## 1. Prerequisites / environment setup (do this first)

1. **Install & run:** `npm install`. Copy `.env.local.example` → `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TIER_1/2/3`
   - `NEXT_PUBLIC_APP_URL`
2. **Apply migrations** to your Supabase project: `supabase db push` (or `supabase migration up`). Confirm all 14 migrations in `supabase/migrations/` applied.
3. **Create Storage buckets** (NOT auto-created — this is required): `avatars`, `logos`, `covers`, `docs`. Make them private; add Storage RLS so an authenticated user may write under a path prefixed by their own `userId` (the upload path is `{bucket}/{userId}/{randomId}.{ext}`) and read their own / public profile assets as appropriate. Verify a real upload works through the profile photo UI before moving on.
4. **Stripe setup:** create the 3 subscription Products/Prices and put their price IDs in `STRIPE_PRICE_TIER_1/2/3`. Add a webhook endpoint pointing at `/api/webhooks/stripe` and put its signing secret in `STRIPE_WEBHOOK_SECRET`. (Webhook handling is already built — see §7.)
5. **Enable Supabase Realtime** for the messaging broadcast channels (typing/read-receipts use `broadcast`, so no table replication needed, but Realtime must be enabled on the project).
6. **Sanity check:** `npm run check` should be green out of the box (1155 tests). Playwright e2e (`npx playwright test`) has ~26 pre-existing failures that need a *seeded* Supabase/Stripe backend — see §10.

---

## 2. What's already WIRED — do NOT rebuild

| Area | Status | Notes |
|---|---|---|
| Presigned uploads | ✅ `lib/storage/index.ts` `createUploadUrl()`, consumed by `components/ui/image-upload.tsx` | Just create the buckets (§1.3). |
| Realtime typing + read-receipt **signals** | ✅ `lib/realtime/index.ts`, consumed in `components/messaging/chat-window.tsx` | Ephemeral broadcast; persistence is the gap (§3). |
| Stripe **subscriptions** (checkout, webhook sync, cancel) | ✅ `lib/stripe/index.ts`, `app/api/webhooks/stripe/route.ts`, `lib/supabase/payments.ts` | |
| Stripe **deal payments** (intent, webhook, history) | ✅ same files | |
| Settings + session **queries** | ✅ `lib/supabase/settings.ts` | Reads work; tables just aren't populated yet (§4, §5). |
| Notification **logging + query + API** | ✅ `lib/notifications`, `lib/supabase/notifications.ts`, `app/api/notifications/route.ts` | Dispatch/transport is the gap (§6). |

---

## 3. Messaging unread counts + read persistence  `[STUB → BUILD]`

**Problem:** `lib/supabase/messaging.ts` → `getConversations()` hard-codes `unreadCount: 0` (the `messages` table has no read state). Read receipts are broadcast-only (not persisted), so unread badges are always 0.

**Build:**
1. **Migration** `supabase/migrations/<ts>_message_read_state.sql` — add a read-state table (recommended over a column):
   ```sql
   create table match_read_states (
     match_id uuid not null references matches(id) on delete cascade,
     user_id  uuid not null references auth.users(id) on delete cascade,
     last_read_message_id uuid references messages(id),
     last_read_at timestamptz not null default now(),
     primary key (match_id, user_id)
   );
   alter table match_read_states enable row level security;
   create policy "own read state" on match_read_states
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
2. **`lib/supabase/messaging.ts`:**
   - Add `markRead(supabase, matchId, userId, lastReadMessageId)` → upsert into `match_read_states`.
   - In `getConversations()`, replace `unreadCount: 0` with a real count: messages in the match where `sender_id != userId` and `created_at > last_read_at` (or id after `last_read_message_id`). Do it in one query (a lateral/count subquery) to avoid N+1.
3. **Wire the UI:** in `components/messaging/chat-window.tsx`, when the user views a match / on new incoming message, call `markRead(...)` (alongside the existing broadcast `sendReadReceipt`). The inbox badge in `components/messaging/match-list.tsx` already renders `unreadCount`.
4. **Acceptance:** opening a conversation zeroes its badge; a new inbound message increments it; refresh persists. **Tests:** unit-test `getConversations` unread math and `markRead` upsert with a mocked client.

---

## 4. Active sessions + login history population  `[SCHEMA OK → POPULATE]`

**Problem:** tables `active_sessions` and `login_history` exist (migration `20260419000010`) with read queries in `lib/supabase/settings.ts`, but nothing ever inserts rows, so Settings → Security shows empty lists.

**Build:**
1. Add writer functions in `lib/supabase/auth.ts` (service-role): `recordLogin(supabase, userId, { success, ip, userAgent, location })` → insert `login_history`; `upsertSession(supabase, userId, { sessionToken, ip, userAgent, deviceLabel })` → insert/update `active_sessions.last_active_at`.
2. Call them from the auth handlers — `app/api/auth/login/route.ts` (or the Supabase auth callback) on success AND failure for login_history; create/refresh an `active_sessions` row on successful login. Extract IP/UA from request headers (`x-forwarded-for`, `user-agent`); derive coarse location server-side if you have a geo source (optional — store null otherwise).
3. `revokeSession()` already deletes; ensure the Security UI calls it (it does via `lib/supabase/settings.ts`).
4. **Acceptance:** logging in from a device creates a session + a login_history row; the Security settings page lists them; "sign out session" removes it. **Tests:** unit-test the writer functions.

---

## 5. Two-factor authentication (TOTP)  `[SCAFFOLDED → BUILD]`

**Problem:** table `auth_2fa` exists (`user_id`, `secret`, `enabled`, `recovery_codes[]`, `confirmed_at`) but there are **no** lib functions or API routes; the Settings → Security 2FA UI has nothing to call.

**Build:**
1. `npm i otplib qrcode` (or `speakeasy`). Create `lib/supabase/auth-2fa.ts`:
   - `begin2FA(supabase, userId)` → generate TOTP secret, store it (unconfirmed), return `otpauth://` URI + QR data URL.
   - `confirm2FA(supabase, userId, token)` → verify the TOTP token, set `enabled=true`, `confirmed_at`, generate + return hashed `recovery_codes`.
   - `disable2FA(supabase, userId, token)` → verify then clear.
   - `verify2FALogin(supabase, userId, token)` → used during login if enabled.
2. API routes `app/api/auth/2fa/{begin,confirm,disable}/route.ts` (auth required).
3. Wire the Settings → Security section (`components/athlete/settings-form.tsx` section 7 + equivalent) to show the QR on begin, confirm with a code, and display recovery codes once.
4. Enforce in the login flow when `auth_2fa.enabled`.
5. **Acceptance:** enable→scan→confirm→recovery codes; login then prompts for a code; disable works. **Tests:** unit-test begin/confirm/disable with a fixed secret + known TOTP.

---

## 6. Notification dispatch (email / push)  `[PARTIAL → BUILD]`

**Problem:** `lib/notifications/index.ts` `dispatchNotification()` only writes `notification_logs` rows (in-app). No email/push transport, no event triggers, no processor. Table `notification_logs` (channel enum push|email|in_app) exists.

**Build:**
1. **Choose providers:** email (Resend / SendGrid / Postmark) and push (Web Push/VAPID or FCM). Add their keys to `.env.local` + `.env.local.example`.
2. **Push token storage migration:** `push_subscriptions(user_id, endpoint, keys jsonb, created_at)` with owner RLS.
3. **Transport in `lib/notifications/`:** `sendEmail(to, subject, body)` and `sendPush(userId, payload)` wrapping the provider SDKs. Extend `dispatchNotification()` so that for `email`/`push` channels it actually sends (and records success/failure on the log row — add `sent_at`/`error` columns if needed).
4. **Event triggers:** call `dispatchNotification()` from the relevant server actions / API routes per the spec's notification matrix (New Match, New Message, Proposal Received, Counter-Proposal, Contract to Sign, Payment Received, Profile Approved/Rejected, etc.). Respect the user's `profile_settings.notification_matrix` (per-event Push/In-App/Email) and `quiet_hours`/`email_digest`/`marketing_opt_in`.
5. **Optional digest cron:** `app/api/cron/notifications/digest/route.ts` (Vercel Cron) for daily/weekly email digests.
6. **Acceptance:** triggering an event respects the user's matrix and sends via the chosen channels; in-app still logs. **Tests:** unit-test channel fan-out + matrix/quiet-hours gating with mocked transports.

---

## 7. Stripe Connect (athlete payouts) + saved payment methods  `[SCAFFOLDED → BUILD]`

**Problem:** schema exists (migration `20260419000011`: `athlete_profiles.stripe_connect_*`, `payout_*`; table `payment_methods`) but there are **no** Stripe functions for Connect or saved cards. Subscriptions + deal payments are already fully wired — don't touch those.

**Build:**
1. **`lib/stripe/connect.ts`:** `createConnectAccount(athlete)`, `getOnboardingLink(accountId, returnUrl)` (Account Links), `refreshConnectStatus(accountId)` (read charges/payouts enabled → map to the `stripe_connect_status` enum), `createPayout/Transfer(...)` for releasing milestone funds to connected accounts.
2. **`lib/stripe/payment-methods.ts`:** `attachPaymentMethod`, `listPaymentMethods`, `setDefault`, `detach` — sync into the `payment_methods` table.
3. **API routes:** `app/api/payments/connect/{link,status}/route.ts`, `app/api/payments/methods/{list,attach,default,delete}/route.ts`. Add Connect webhook events (`account.updated`) to the existing `app/api/webhooks/stripe/route.ts` to keep `stripe_connect_status` fresh.
4. **Wire UI:** athlete Settings → Payments (`components/athlete/settings-form.tsx` section 5) Connect onboarding button + status; brand billing card manager (`components/brand/brand-settings-form.tsx`).
5. **`lib/supabase/payments.ts` `listSeats()`** currently returns `members: []` — if you want real seat members, add a `subscription_seats` table + populate; otherwise leave the counts.
6. **Acceptance:** athlete completes Connect onboarding and status flips to `active`; brand can save/list/default/remove a card. **Tests:** unit-test the table-sync logic with mocked Stripe.

---

## 8. GDPR data export processor  `[STUB → BUILD]`

**Problem:** `requestDataExport()` inserts a `data_export_requests` row (status `pending`) but nothing fulfils it. `app/api/cron/` is empty.

**Build:**
1. **Processor:** `app/api/cron/data-export/route.ts` (Vercel Cron, service-role): select `pending` requests → set `processing` → gather the user's data via `lib/supabase` reads (profile, messages, payments, connections, settings) into JSON/CSV → ZIP (`archiver`) → upload to a private `docs`/`exports` bucket via `lib/storage` → create a 72h presigned download URL → update row `status='ready', download_url, completed_at, expires_at = now()+72h`. On error set `failed`.
2. **Status endpoint:** `app/api/settings/data-export/route.ts` (GET latest request for the user; POST to create — wrap `requestDataExport`).
3. **Wire UI:** the "Download My Data" button (Settings → Privacy & Data) calls POST then polls GET; show a download link when `ready`.
4. **Acceptance:** request → (cron runs) → `ready` with a working, expiring download. **Tests:** unit-test the aggregation + status transitions with mocks.

---

## 9. Cookie consent  `[SCHEMA OK → BUILD]`

`users.cookie_prefs` (jsonb) exists. Add a consent banner component (essential/analytics/marketing categories), persist via a small `lib/supabase` updater + `app/api/settings/cookie-prefs/route.ts`, and gate analytics/marketing scripts on the stored choice. Acceptance: choice persists across sessions; analytics only loads when opted in.

---

## 10. Verification & known state

- **`npm run check`** must stay green after each task (1155 tests today). Add tests with each feature.
- **Playwright e2e** (`npx playwright test`): ~26 failures are **pre-existing/environmental** — they exercise `app/api/*`, auth pages, and `middleware.ts` against a backend that isn't seeded in CI (unauth calls return 200 instead of 401). They are NOT regressions (those files are unchanged from the original baseline). Once you point the suite at a **seeded** Supabase project with a test user + auth, they should pass; otherwise gate them behind a backend-available flag.
- Regenerate `types/database.ts` after every migration and re-run type-check.

---

## 11. Suggested build order (dependencies)

1. **Setup §1** (env, migrations, buckets, Stripe, Realtime) — unblocks everything.
2. **§3 messaging unread**, **§4 sessions/login history** — small, high-visibility, no external providers.
3. **§5 2FA** — needs an npm lib only.
4. **§6 notifications** — needs email/push provider accounts.
5. **§7 Stripe Connect / cards**, **§8 data export**, **§9 cookies** — larger / external.

Each is independent; parallelise across agents if desired, but keep one agent per `lib/` module to avoid edit collisions, and run `npm run check` before merging each.
