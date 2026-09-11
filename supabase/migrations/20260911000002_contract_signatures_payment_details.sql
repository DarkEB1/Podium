-- The Athlete's per-deal payment details, captured at signing so the Sponsor
-- can pay the Fee directly (P2P). Podium never touches deal money; these details
-- live only on the athlete's signature row for this one contract and are
-- rendered into that contract's signed PDF.
--
-- Sensitive personal/financial data. No new policy is needed: the existing
-- contract_signatures_select policy already scopes reads to the contract's
-- participants (brand/athlete/agent) and admins, and the table has no client
-- write policy (rows are written service-role only). erase_user_data nulls this
-- column alongside the other signer PII (see 20260911000003).

alter table public.contract_signatures
  add column if not exists payment_details jsonb;

comment on column public.contract_signatures.payment_details is
  'Athlete-supplied bank/payment details for this deal (P2P), captured at signing and rendered into the signed PDF. Participant-scoped via RLS; service-role write only; scrubbed by erase_user_data.';
