# Pre-rollout manual steps

Everything here needs a human. Claude is blocked from these by the permission
layer (schema pushes, production deploys, production env changes), and the
production auth decisions are yours to make.

Written 2026-08-05, after the QA round and the reviewer sweep. All code changes
referenced are on `staging`.

## 1. Apply the three new migrations

None are applied yet. All three are additive and backward compatible with the
code currently live, and the app code was written to tolerate their absence, so
there is no rush ordering problem: apply to staging, check, then apply to
production BEFORE `staging` merges to `main`.

| Migration | What it does |
|---|---|
| `20260805000000_admin_role_not_self_assignable` | Closes the privilege escalation below. |
| `20260805000100_brand_industry_other` | Adds `brand_profiles.industry_other`, without which the "Other" industry answer cannot save. |
| `20260805000200_payments_intent_unique` | One `payments` row per Stripe intent; collapses existing duplicates first. |

```bash
# staging
npx supabase link --project-ref cltvgjsmzujsrnmnfues
SUPABASE_DB_PASSWORD="$SUPABASE_STAGING_DB_PASSWORD" npx supabase db push

# production, before merging staging into main
npx supabase link --project-ref wchvidibjhjhchorjsup
npx supabase db push
```

**The CLI link is currently left on STAGING**, not production as CLAUDE.md
requires. The second block above puts it back.

## 2. Audit for self-assigned admins

`users_update_own` enforced the role LOCK but never the role VALUE, and every
account starts unlocked, so any user could `PATCH /rest/v1/users?id=eq.<self>`
with `role=admin` using their own access token and the public anon key, then
pass every `role === 'admin'` gate. The hole was open in production.

Run on BOTH projects after applying migration 1:

```sql
select id, email, role, role_locked_at, created_at
from public.users
where role = 'admin'
order by created_at;
```

Every row should be an admin you deliberately created. Anything else was
self-granted. Demote with the service role (RLS does not apply to it).

## 3. Decide production auth confirmation

Staging now requires email confirmation and sends auth mail through Resend
(`[remotes.staging]` in `supabase/config.toml`). Production was NOT touched.

The tester could sign in without verifying, which suggests production still has
`enable_confirmations` off and is still on Supabase's built-in mailer (roughly
two emails an hour, best effort), which is why the verification email never
arrived.

Turning confirmation on in production is a real product decision: existing
unconfirmed accounts will be locked out at next sign-in. Decide how to handle
them first, then add a `[remotes.production]` block mirroring the staging one
and `supabase config push` while linked to production.

## 4. Create the support mailboxes

Every support, legal and privacy address was pointing at `podium.com`, which is
someone else's domain. They now read `@podiumsponsorship.com`
(`CONTROLLER` in `lib/legal/versions.ts`), but the mailboxes have to exist:

- `hello@podiumsponsorship.com`, where the contact form delivers
- `privacy@podiumsponsorship.com`, named in the privacy policy
- `legal@podiumsponsorship.com`, named in the terms

Cloudflare Email Routing is the quickest option, forwarding to whatever you
actually read. Until then contact submissions will bounce at the mailbox.

## 5. Known gaps, deliberately not fixed

- **In-app card payments do not exist.** The brand payments page used to offer
  an "Initiate payment" button that created a Stripe PaymentIntent, discarded
  the client secret and reported success, so the charge could never complete.
  It has been removed and the page now says so plainly. Building it properly
  means Stripe Elements plus a confirmation step, and Stripe is still in test
  mode. Payment amounts and the duplicate-row problem are fixed either way, so
  the flow is correct whenever it is built.
- **No Resend bounce or complaint webhook.** The suppression list defines
  `hard_bounce` and `complaint`, but nothing writes them, so a dead address is
  retried forever. That erodes the new domain's sender reputation right at
  launch. Worth adding before volume grows.
- **`contract_fully_signed` email is never sent.** The event, template and user
  preference toggle all exist; no code path fires it. Users who enable that
  notification are waiting on something that cannot arrive.
- **Subscription checkout does not check for an existing subscription**, so two
  tabs can create two Stripe subscriptions while the local table records one.
