# P2P payment details in the signed contract + payout dead-code cleanup

Branch `feat/esign-p2p-payment` (off `origin/staging`). Session session_011m4JnEhof5BDPpJxxinxCs.

## What shipped in this branch (Task A, Option 2)

The signed Athlete Sponsorship Agreement now reflects the real payment model: the
Sponsor pays the Athlete **directly** (P2P, off-platform), and the Athlete's
receiving account is captured at signing and rendered into that contract's PDF.

- **Section 6 reworded** (`lib/esign/agreement.ts`): dropped "Payment is arranged
  through the Podium platform"; now says the Sponsor pays the Athlete directly and
  Podium "is not a party to the payment and does not receive, hold, or disburse the
  Fee." The platform-fee line now says Podium's own subscription/platform fees are
  separate from and do not reduce the Fee.
- **Capture at signing** (`components/deals/review-and-sign-dialog.tsx`): the
  athlete/team signer (the payee) sees optional "Payment details" fields (account
  holder, bank, sort code, account number, and a free-text line for IBAN/SWIFT/
  reference/other methods). The brand (payer) never sees them.
- **Storage**: written to the new `contract_signatures.payment_details` jsonb column
  on the athlete's signature row (service-role write; participant-scoped read via the
  existing RLS `contract_signatures_select`). Rendered into that one contract's PDF at
  finalize. Absent -> Section 6 falls back to "pay to the payment details the Athlete
  provides" (no placeholder).
- **GDPR**: `erase_user_data` now nulls `payment_details` alongside the other signer
  PII (migration `20260911000003`).

Flow: sign route body.paymentDetails -> `normalizePaymentDetails` -> `recordSignature`
-> `contract_signatures.payment_details` -> `finalize` reads the athlete row ->
`renderContractPdf` -> Section 6.

### Migrations to apply (staging first, then prod, BEFORE code merges to main)

Both are additive and backward compatible with the code currently live.

1. `supabase/migrations/20260911000002_contract_signatures_payment_details.sql`
   - `alter table public.contract_signatures add column if not exists payment_details jsonb;`
2. `supabase/migrations/20260911000003_erase_user_data_payment_details.sql`
   - `create or replace function public.erase_user_data(...)` reproducing the current
     body unchanged plus `payment_details = null` in the signature anonymisation block.

Apply via **direct psql** (NOT the supabase CLI, per the config-push hazard). Prod
pooler host `aws-1-eu-west-2.pooler.supabase.com`, staging `aws-0-...`. Record the two
version rows in `supabase_migrations.schema_migrations` after applying.

## Dead payout code (Task A cleanup)

Under pure P2P there is no platform payout, so the misleading Stripe Connect "Set up
payouts" UI was removed:

- Removed the athlete Settings "Payout account" card, the `startPayoutSetup` handler,
  the `startingPayout` state, and the `STRIPE_CONNECT_LABELS` map
  (`components/athlete/settings-form.tsx`). Replaced with a short "How you get paid"
  note explaining the Sponsor pays directly per deal.

### Left in place (flagged, NOT changed here)

- The **columns stay**: `athlete_profiles.payout_method`, `payout_bank_name`,
  `payout_account_holder`, `payout_account_last4`, `payout_sort_code_last4`,
  `payout_country`, `stripe_connect_account_id`, `stripe_connect_status`,
  `stripe_connect_onboarded_at`. They are never written and are kept on the
  `PROTECTED_FIELDS` denylist in `lib/supabase/profiles.ts` (removing the denylist
  without dropping the columns would re-open a write path, so both stay together).
- The `POST /api/account/connect` route is now unreferenced by any UI (dead).

### Follow-up needing your go-ahead: physically drop the columns

Dropping the 9 columns is a destructive prod migration with entanglement, so it is a
**separate, flagged migration** not included here:

- Column-level `revoke select (...) from anon` on `athlete_profiles`
  (`20260904000101`) lists all 9 columns. Postgres drops those column grants
  automatically when the column is dropped, so the drop itself is mechanically safe,
  but it must be verified.
- The enums `public.payout_method` and `public.stripe_connect_status` would become
  candidates to drop too, but **must be checked against `connect_accounts`** (the real
  Stripe Connect source) and any other table before dropping.
- Static migration tests in `20260419000011` / `20260904000101` assert the historical
  migration text and are unaffected.

If you want the columns gone, say so and I will write + stage that migration
(staging -> prod, direct psql) on its own.

## Task B: branded auth emails

`supabase/templates/{confirmation,recovery,magic_link,email_change,invite}.html` match
the transactional shell. The `[auth.email.template.*]` blocks in `supabase/config.toml`
are **commented out** on purpose. Do NOT `config push`. Apply:

- **Production**: paste each template into the Supabase dashboard (Authentication ->
  Emails), with the subject lines in `docs/esign-integration/auth-email-branding.md`.
- **Staging**: dashboard, or a human-reviewed `config push` you run yourself.

## One human verification step (carried over)

Click through the real Review & Sign modal once on staging/prod to 100%-confirm the
base-ui modal submit (the unit tests prove the enable/submit logic; the modal was
automation-hostile under CDP).
