-- Drop the dead payout / Stripe Connect mirror columns from athlete_profiles.
--
-- These were added in 20260419000011 but were never written (they are on the
-- profiles PROTECTED_FIELDS denylist and were always null), and the settings UI
-- that displayed them / offered Stripe Connect "payouts" has been removed. Under
-- Podium's P2P model the Sponsor pays the Athlete directly and Podium never
-- holds payout details. The real Stripe Connect account state, if Connect is
-- ever used, lives in public.connect_accounts (a separate table) — not here.
--
-- No view depends on these columns; the column-level privilege REVOKEs in
-- 20260904000101 are removed automatically when the columns are dropped. The two
-- enums are used only by the columns being dropped (verified against
-- connect_accounts and all code), so they are dropped too.

alter table public.athlete_profiles
  drop column if exists payout_method,
  drop column if exists payout_bank_name,
  drop column if exists payout_account_holder,
  drop column if exists payout_account_last4,
  drop column if exists payout_sort_code_last4,
  drop column if exists payout_country,
  drop column if exists stripe_connect_account_id,
  drop column if exists stripe_connect_status,
  drop column if exists stripe_connect_onboarded_at;

drop type if exists public.payout_method;
drop type if exists public.stripe_connect_status;
