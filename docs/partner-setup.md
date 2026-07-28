# Podium — Account & Environment Setup (for the partner)

This is everything that needs setting up on the account/infrastructure side to
turn on the features now built in the code. The code is written to **fail closed**:
every integration below is a no-op or shows "not configured" until its keys are
set, so nothing breaks while these are outstanding. You can do them in any order.

After you set keys in production, the admin app has a live checklist at
**`/admin/config`** that shows which integrations are configured (presence only,
never the values). Use it to confirm each item as you go.

---

## 0. One-time, do first

1. **Apply the new database migrations.** From the repo: `supabase db push`.
   New since the last handoff:
   - `20260728000000_guardian_consent_enforcement`
   - `20260728000100_prelaunch_cron_jobs`
   - `20260728000200_verification_requests`
   - `20260728000300_push_subscriptions`
   - `20260728000400_connect_accounts`
   - `20260728000500_social_connections`
2. **Hosting: Vercel.** The cron jobs are written against Vercel Cron (see
   `vercel.json`). Deploy the project to Vercel and set the env vars below in the
   Vercel project settings (Production + Preview).
3. **Domain, DNS, SSL.** Register the domain, point it at Vercel, let Vercel
   issue the certificate. Set `NEXT_PUBLIC_APP_URL` to the final origin
   (e.g. `https://getpodium.app`) — several features build absolute links from it.

---

## 1. Already needed (unchanged from before)

| Service | Env vars | Notes |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Already in use. |
| Stripe (subscriptions) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_TIER_1..3` | Already in use. Webhook endpoint: `/api/webhooks/stripe`. |
| Resend (email) | `RESEND_API_KEY`, `EMAIL_FROM` (+ optional `EMAIL_REPLY_TO`) | Verify a sending domain in Resend. Until set, ALL email (verification, password reset, guardian consent, deal notices) silently no-ops. **Highest value to turn on.** |
| Cron | `CRON_SECRET` | `openssl rand -hex 32`. Without it every `/api/cron/*` job is rejected and never runs (GDPR erasure, chat clear, guardian expiry, 18th-birthday transfer, data export). |
| Unsubscribe | `UNSUBSCRIBE_SECRET` | `openssl rand -hex 32`. One-click unsubscribe links. |

---

## 2. New — no external account, just generate a key

These need no third-party signup. Generate and paste.

| Feature | Env vars | How | If unset |
|---|---|---|---|
| Admin & user 2FA | `TWO_FACTOR_ENCRYPTION_KEY` (64 hex chars), `ADMIN_2FA_COOKIE_SECRET` (≥16 chars) | `openssl rand -hex 32` each | Admins are locked out of `/admin` until set; user 2FA enrollment fails. **Set these before an admin signs in.** |
| Push notifications | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` (public key goes in both the `NEXT_PUBLIC_` and server var); `VAPID_SUBJECT` = `mailto:ops@yourdomain.com` | Push simply no-ops; users can still enable it once keys are set. Smoke-test one real browser push after enabling. |

`TWO_FACTOR_ENCRYPTION_KEY` also encrypts stored social-account tokens, so set it
if you turn on social OAuth too.

---

## 3. New — needs an external account/decision

### 3.1 Stripe Connect (athlete/team payouts)
1. In the Stripe dashboard, **enable Connect** (Express).
2. Add a **Connect webhook** endpoint pointing at `/api/webhooks/stripe-connect`,
   subscribed to `account.updated`. Put its signing secret in
   `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. Pick a **KYC/identity provider** if you want the verification badge to be
   automated (Stripe Identity, Persona, or Onfido). Not required for launch — the
   verification queue works with manual admin review today.

Until Connect is enabled, the payout onboarding button returns a clear "Connect
is not enabled" message rather than half-creating anything.

### 3.2 Companies House (brand verification)
Register for a Companies House API key if you want automated brand-legitimacy
checks. Not wired to a specific env var yet — tell me when you have it and I'll
wire the lookup. Manual admin verification covers brands in the meantime.

### 3.3 Social account OAuth
Register a developer app per platform and add its client id + secret. Each is
independent and shows "Coming soon" until configured. For every app, set the
**redirect/callback URL** to `https://<your-domain>/api/social/<provider>/callback`.

| Platform | Provider slug | Env vars | Callback URL |
|---|---|---|---|
| Instagram / Meta | `meta` | `META_CLIENT_ID`, `META_CLIENT_SECRET` | `/api/social/meta/callback` |
| TikTok | `tiktok` | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | `/api/social/tiktok/callback` |
| X | `x` | `X_CLIENT_ID`, `X_CLIENT_SECRET` | `/api/social/x/callback` |
| YouTube (Google) | `youtube` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `/api/social/youtube/callback` |
| LinkedIn | `linkedin` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `/api/social/linkedin/callback` |

Review times run long for some of these, so start the registrations early. Note:
the connect flow uses the standard OAuth2 code exchange; X (PKCE) and Meta
(long-lived token exchange) have per-provider quirks I will finish wiring once
their apps exist and I can test against them.

### 3.4 E-signature (decision)
The in-house click-to-sign signer is the default and needs nothing. If you want
DocuSign or HelloSign instead, that is now a config switch (`ESIGNATURE_PROVIDER`
plus that provider's credentials). Decide whether to stay in-house or provide an
account; the external adapter is stubbed until you choose.

---

## 4. Quick reference — what each unset key costs

Nothing crashes when a key is missing. Specifically:
- No Resend key → no emails sent (logged as "skipped").
- No 2FA keys → admins can't access `/admin`; users can't enable 2FA.
- No VAPID keys → push stored but not delivered.
- No Stripe Connect → payout onboarding shows a clear "not enabled" message.
- No social app creds → that platform shows "Coming soon".
- No `CRON_SECRET` → scheduled jobs are rejected and never run.

Once everything you want is set, confirm on `/admin/config`.
