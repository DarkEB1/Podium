# Plan: P2P payment details in the signed contract + auth email branding

Branch: `feat/esign-p2p-payment` (off `origin/staging` @ ca3df14). Worktree: `Podium-esign-pay`.
Session: session_011m4JnEhof5BDPpJxxinxCs

Decisions confirmed with Nicholas (2026-09-11):
- Task A payment model: **Option 2** — per-deal bank details entered by the athlete at signing, stored on that contract's signature row, rendered into that contract's PDF only.
- Dead payout code: **remove** the Stripe Connect "Set up payouts" button + the dead payout display. Column drop is a separate flagged migration (do not drop silently).
- Task B: **author branded auth-email HTML** only (transactional emails already branded; no polish this pass). Running in a parallel subagent.

Ground truth: Podium's only Stripe money is the brand subscription; the sponsorship Fee is P2P brand→athlete, off-platform. The contract must reflect direct P2P, not "arranged through the Podium platform."

## Task A — payment details (Option 2), TDD

1. **Migration (additive, safe)** `supabase/migrations/2026090800000X_contract_signatures_payment_details.sql`
   - `alter table public.contract_signatures add column if not exists payment_details jsonb;`
   - comment. No RLS change needed (existing `contract_signatures_select` already scopes reads to contract participants + admin; writes are service-role only). Static SQL-text test.
   - Hand-edit `types/database.ts` contract_signatures Row/Insert/Update to add `payment_details: Json | null` (real regen is a human step, per repo pattern).

2. **`erase_user_data` GDPR update** new migration reproducing the full function body from `20260907000004_erase_user_data_esign.sql` UNCHANGED, adding `payment_details = null` to Block A (bank details are personal financial data → must be scrubbed on erasure). Static text test asserting Block A nulls payment_details.

3. **`lib/esign/payment-details.ts`** (new) — `AgreementPaymentDetails` type + `normalizePaymentDetails(input: unknown): AgreementPaymentDetails | null` (trim, length-cap each field, drop empties, return null if all empty). Unit tests. Shape: accountHolderName, bankName?, accountNumber?, sortCode?, iban?, swiftBic?, reference?, instructions? (all optional strings). Forgiving — no strict bank-format validation (international varies).

4. **`agreement.ts` Section 6 reword to P2P** + optional payment block.
   - Drop "Payment is arranged through the Podium platform" → "The Sponsor shall pay the Athlete directly ... Podium facilitates and administers this Agreement but is not a party to the payment and does not receive, hold, or disburse the Fee."
   - Clarify the platform-fee line so it cannot read as a cut of the Fee.
   - Add `paymentDetails?: AgreementPaymentDetails | null` to `AgreementInput`. When present, render a "Payment details" lead para + termRows (only the fields present). When absent, a single para: the Sponsor pays to the payment details the Athlete provides. Keep the no-`[PLACEHOLDER]` invariant test green; add tests for present/absent.

5. **Thread the value through** (TDD each):
   - `lib/esign/index.ts` `SignaturePayload` += `paymentDetails?: AgreementPaymentDetails | null`.
   - `app/api/deals/contracts/[contractId]/sign/route.ts` parse `body.paymentDetails` via `normalizePaymentDetails`, pass into `recordSignature` payload.
   - `lib/esign/podium.ts` `recordSignature` writes `payment_details` onto the inserted signature row.
   - `lib/esign/finalize.ts` reads the athlete signature row's `payment_details`, passes as `input.paymentDetails` to `renderContractPdf`.
   - `pdf.tsx` needs NO change (renders blocks generically).

6. **Capture UI** `components/deals/review-and-sign-dialog.tsx` — add optional payment-detail fields, shown only when the signer is the payee (athlete side). New prop `collectPayeeDetails: boolean` threaded from `contract-sign-button.tsx` (`!isBrand`). POST `paymentDetails` in the body. Tests: fields render only when collecting; values POSTed; omitted when blank.

## Dead-code removal (code only; no migration)
- Remove the "Payout account" card (settings-form.tsx ~2128-2170), `startPayoutSetup` (~629-649), `startingPayout` state, `STRIPE_CONNECT_LABELS` (~229-239). Update settings-form.test.tsx (drop the "shows Stripe Connect status and payout bank details" test + the "Set up payouts" assertions; leave the mock's extra props harmless).
- KEEP the `payout_*`/`stripe_connect_*` columns + `profiles.ts` PROTECTED_FIELDS denylist (columns still exist; denylist still guards them). Leave `/api/account/connect` route (server-side dead; flag).
- FLAG to Nicholas (separate follow-up): a staged migration to physically drop the 9 columns + the `payout_method` / `stripe_connect_status` enums. Entangled with `20260904000101` column-level `revoke select` (grants auto-drop with the column) and `connect_accounts` (separate real Connect source). Destructive on prod → needs his explicit apply OK.

## Task B — auth email branding (parallel subagent)
Branded HTML for confirmation/recovery/magic_link/email_change/invite under `supabase/templates/`, a commented `[auth.email.template.*]` config block, and a handoff doc with paste-ready HTML for the prod dashboard. Never config-push (hazard). Merge subagent branch at integration.

## Rollout
- `npm run check` green.
- Apply the 2 additive migrations to **staging** then **prod** via direct psql (NOT supabase CLI) BEFORE code merges to main. Record schema_migrations history rows.
- Merge staging→main = prod deploy. Auth-email apply = human step (dashboard).
