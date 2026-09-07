# Contract e-signature (in-house SES) — design

**Date:** 2026-09-07
**Branch:** `feat/esign-contracts` (worktree `../Podium-esign`, base `origin/staging` @ `c9e39d9`)
**Status:** approved design, pre-implementation

## 1. Goal

Replace Podium's click-to-sign with a real signed contract: generate a branded PDF
term sheet from the accepted proposal, let both parties read it, sign it embedded
in-app with a consent record + audit trail, then produce a locked, downloadable
signed PDF retained for 7 years. Free — Podium runs the signing itself, behind a
provider abstraction so a paid provider (DocuSign/Dropbox Sign/Documenso) can be
swapped in later without touching callers.

## 2. Decisions (locked with Nicholas)

- **Provider:** in-house Simple Electronic Signature (SES). Legal basis = ESIGN/UETA/
  eIDAS *simple* electronic signature — same basis today's click-to-sign already
  relies on, now with a real document + audit trail. **Not** eIDAS-*qualified* (no
  CA/ID verification). Acceptable for sponsorship contracts.
- **Click-to-sign:** **replaced**. The embedded flow is the only sign path. It reuses
  the existing `contracts` columns, the service-role write path, the state machine,
  and the guardian gate — we change the front of the flow, not the back.
- **Term-sheet content:** brand fills **deliverables, usage rights, additional terms**
  (columns/jsonb already exist but the form never captured them — audit DP-17/Y6).
- **Webhook seam:** built now (thin, HMAC-verified, idempotent) as the seam a future
  external provider needs; the in-house path calls the shared finalize function
  directly.
- **Base:** `origin/staging` (`c9e39d9`), which includes the QA-sprint fixes (the
  `contract_fully_signed` email/notification wiring, WS-SEC lockdown, the array-vs-
  object payment fix). This local checkout's stale `aca85…` tree is not used.

## 3. Current state (verified against code 2026-09-07)

- `lib/supabase/deals.ts:signContract` writes `brand_signed_at`/`athlete_signed_at`
  + signer IP/device via the **service-role** client; computes `status` from whether
  the *other* party has signed (either order allowed); sets `locked_at` on the
  transition to `fully_signed`. `retain_until` is set by the DB trigger
  `contracts_set_retain_until` (locked_at + 7y), **not** in code.
- `components/deals/contract-sign-button.tsx` is a plain `POST /api/deals/contracts/
  [contractId]/sign` trigger; swaps to a guardian-consent button on
  `GUARDIAN_CONSENT_REQUIRED`.
- `contracts` already has unused `document_url`, `esignature_provider`,
  `esignature_envelope_id`, `agent_signed_at/agent_signer_ip`, `terminated_at`,
  `termination_reason`. `terms_snapshot` (jsonb) is the pinned source of truth
  (`title, deliverables, pay_amount, pay_currency, pay_type, timeline_start/end,
  usage_rights, additional_terms, snapshot_at`).
- Contract creation is atomic in the `accept_proposal` RPC (starts
  `pending_brand_signature`, `on conflict (proposal_id) do nothing`). RLS on
  `contracts` = **SELECT-only** for participants + admin; all writes service-role.
- Guardian gate: trigger `contracts_enforce_guardian_consent` blocks
  `athlete_signed_at` transition when the athlete is under 18 with no
  `guardian_accepted_at`. Keep unchanged.
- Storage: private `docs` bucket; presigned helpers in `lib/storage/index.ts`; object
  read governed by `select_docs` (`can_read_user_folder`, active-match based); writes
  confined to `auth.uid()` folder. Service role bypasses RLS for writes.
- `middleware.ts` `PUBLIC_PATHS` already matches `/api/webhooks` by prefix — no change
  needed for `/api/webhooks/esign`.
- `contract_fully_signed` email (`lib/email/*`) + `dispatchNotification`
  (`lib/notifications`) exist but **nothing sends the full-signature event** yet.
- No PDF library installed. Playwright present as e2e runner only.

## 4. Architecture — `lib/esign/` (mirrors `lib/stripe/`)

- `lib/esign/index.ts` — `EsignProvider` interface + `provider()` selector reading
  `serverEnv().ESIGN_PROVIDER` (default `'podium'`). Interface (minimal, YAGNI):
  - `createEnvelope(contract, terms, parties) -> { envelopeId }`
  - `recordSignature(envelopeId, signerRole, signaturePayload) -> void`
  - `finalizeEnvelope(envelopeId) -> { documentPath, documentHash }`
- `lib/esign/podium.ts` — in-house implementation: persists per-signer records,
  generates PDFs, hashes, finalizes.
- `lib/esign/pdf.tsx` — branded renderer using **`@react-pdf/renderer`** (pure JS,
  serverless-safe on Vercel, no headless Chromium; Helvetica built-in; ink `#2E3440`,
  accent `#456489`). Renders the term sheet + an audit-certificate page in one pass.
- `lib/esign/audit.ts` — SHA-256 over final PDF bytes; per-signature audit record.
- `lib/esign/finalize.ts` — the single `finalizeContract(envelopeId)` used by BOTH
  the synchronous in-house sign path AND the webhook route: generate signed PDF +
  hash, upload to storage, set `status='fully_signed'`, `locked_at`, `document_url`,
  `document_hash`; fire `contract_fully_signed` email + in-app notification.
  Idempotent (no-op if already `fully_signed`).
- Co-located `*.test.ts`, mocks matching **real return shapes** (array-vs-object P0
  lesson).

All DB access stays in `lib/supabase/`; `lib/esign/` calls those helpers (no direct
Supabase in `lib/esign/` beyond the storage/admin helpers it mirrors from stripe).

## 5. Data model + migrations (reserved range `20260907000001…000099`)

1. `20260907000001_contract_signatures.sql` — new table `public.contract_signatures`:
   `id`, `contract_id` (fk contracts, on delete restrict), `signer_role`
   (`brand`/`athlete`/`agent` check), `signer_user_id` (fk users), `typed_name text`,
   `signature_image_path text` (docs bucket, nullable), `consent_text text not null`,
   `signer_ip text`, `signer_device text`, `signed_at timestamptz not null`,
   `signature_hash text not null`, `created_at`. Unique `(contract_id, signer_role)`.
   **RLS on**: SELECT for contract participants (via a subquery on `contracts`) +
   `is_admin()`; **no client write policy** (service-role only — mirrors contracts).
2. `20260907000002_contracts_esign_columns.sql` — add `document_hash text` to
   `public.contracts` (audit cert folded into `document_url` PDF's last page; no
   separate url column). `esignature_provider`/`esignature_envelope_id` already exist.
3. `20260907000003_storage_contract_docs_policy.sql` — storage RLS policy
   `select_contract_docs`: authenticated read on objects whose path is
   `contracts/<contractId>/…` when `auth.uid()` is a participant in that contract
   (match-independent; retention governs deletion, not match state). Writes remain
   service-role. Path convention: `contracts/<contractId>/signed-<hash8>.pdf` and
   `contracts/<contractId>/signatures/<role>.png`.
4. `20260907000004_erase_user_data_esign.sql` — extend `erase_user_data` to null a
   signer's `signer_ip`/`signer_device`/`signature_image_path`/`typed_name` in
   `contract_signatures` (keep `signed_at` + `signature_hash` for integrity), and drop
   the signed PDF object + `document_url`/`document_hash` only once `retain_until` has
   passed — same rule the contracts table already follows.

**Tests:** each migration gets a static SQL-text test (repo pattern, e.g.
`20260805000000_admin_role_not_self_assignable.test.ts`). **Plus a live-DB check on
staging** — SQL-text tests miss semantic no-ops (that gap cost a P0). Regenerate
`types/database.ts` after the table/columns land.

## 6. Term-sheet capture (brand fills the doc — fixes DP-17/Y6)

Extend `components/brand/proposal-form.tsx` + its zod schema to capture
`deliverables` (a free-text area stored in the existing jsonb as `{ text: string }`
— no structured line-item UI; YAGNI), `usage_rights` (text), `additional_terms`
(text). These
already flow through `ProposalPayload` → `accept_proposal` → `terms_snapshot`; only
the form omits them. The PDF is a fixed Podium sponsorship term-sheet template with
these as filled slots: parties (names + company), amount/currency/pay type, timeline,
deliverables, usage rights, additional terms. The on-page "This is what you're
signing" block renders from the same `terms_snapshot`.

## 7. Signing flow (embedded, replaces click-to-sign)

- `contract-sign-button.tsx` → **"Review & Sign"** opens an embedded modal: renders
  the term sheet, captures **typed name + optional drawn signature (canvas)** + a
  **required consent checkbox** ("I agree this is my electronic signature and intend
  to be legally bound"), then `POST`s to the sign route with the signature payload.
- **Order:** brand first → athlete (agent last, if ever present). Guardian gate
  unchanged. Agent-represented deals aren't creatable today (`accept_proposal` PD010),
  so agent handling is forward-compatible only — no new UI.
- Sign route (service role): create the envelope on first sign (`esignature_provider
  = 'podium'`, `esignature_envelope_id` = generated uuid); write `contract_signatures`
  row + existing `contracts.*_signed_at/ip/device`; upload the drawn signature PNG.
  When the **second** party signs → call `finalizeContract(envelopeId)` directly.

## 8. Webhook seam — `app/api/webhooks/esign/route.ts`

Built now as the external-provider seam; dormant for in-house (which finalizes
synchronously). Pattern mirrors the Stripe webhook:
- `export const dynamic = 'force-dynamic'`; read raw body; verify HMAC against
  `serverEnv().ESIGN_WEBHOOK_SECRET` **before any processing** (400 on missing/invalid).
- Idempotent, envelope-id keyed: the route looks up the contract by
  `esignature_envelope_id` and delegates to `finalizeContract`, whose
  no-op-if-already-`fully_signed` guard makes repeated deliveries safe without a
  separate events table. (A `claim_esign_webhook_event` table is added only when an
  external provider that needs replay protection is plugged in — deferred.)
  declined/voided → set `terminated_at`/`termination_reason`.
- `PUBLIC_PATHS` already matches `/api/webhooks` prefix — no middleware change.

## 9. Viewing / download

Deal detail pages (`app/(brand|athlete|team)/…/deals/[proposalId]/page.tsx`): always
render the terms block; once `fully_signed`, a **View / Download PDF** action backed by
`createSignedDownloadUrl` (10-min TTL) scoped to participants via `select_contract_docs`.
No public access.

## 10. GDPR / retention

`erase_user_data` retains contracts via `retain_until` (locked_at + 7y). Extend it to
cover `contract_signatures` + the signed PDF object (see migration 4). Confirm the
signed PDF path and audit records are covered by the retention/erasure policy in the
live-DB check.

## 11. Testing (TDD)

- Unit: `lib/esign/` with real-shape mocks; PDF renders a valid PDF + stable hash;
  audit record correctness; `finalizeContract` idempotency.
- Migration: static SQL-text tests + live-DB check on staging.
- E2e (Playwright): accept → brand signs → athlete signs → finalize → `fully_signed`
  → download PDF. Plus guardian-gate block and finalize idempotency.

## 12. Human steps (surface to Nicholas — not done by the agent)

- Add `ESIGN_PROVIDER=podium` and `ESIGN_WEBHOOK_SECRET` to Vercel **Preview +
  Production** (never committed). Local `.env.local` for dev.
- Apply the `20260907*` migrations: staging first (`cltvgjsmzujsrnmnfues`), then
  production (`wchvidibjhjhchorjsup`) per CLAUDE.md order, before any merge to `main`.
  **Never `config push` to prod Supabase** (auth-clobber hazard).
- Regenerate `types/database.ts` after the table/columns are applied to staging.
- Deploy / merge decisions to `main` remain human steps; ship to staging and see it
  working first.

## 13. Out of scope (YAGNI)

- eIDAS-qualified / ID-verified signatures.
- Agent-represented deal UI (not creatable today).
- Multi-document envelopes; templates management UI.
- External provider implementation (only the seam; a later task plugs one in).
