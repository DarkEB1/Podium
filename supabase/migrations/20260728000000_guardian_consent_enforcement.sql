-- ============================================================
-- 2.3 — GUARDIAN CONSENT ENFORCEMENT (under-18 athletes)
--
-- athlete_profiles already carries date_of_birth, is_under_18 (trigger-computed
-- in 20260419000002_profiles.sql), the guardian_* contact columns and
-- guardian_accepted_at. Consent was COLLECTED but never ENFORCED: an under-18
-- athlete could sign a binding contract with no guardian involvement.
--
-- This migration adds two things:
--   1. guardian_consent_tokens — a capability table backing the email link a
--      guardian follows to grant one-time blanket consent (sets
--      athlete_profiles.guardian_accepted_at). Only the raw token's SHA-256
--      hash is stored; possession of the raw token is the capability.
--   2. A BEFORE UPDATE trigger on contracts that refuses an under-18 athlete's
--      signature until guardian_accepted_at is set. Because it is a trigger it
--      fires even on the service-role path used by lib/supabase/deals.ts
--      signContract, which bypasses RLS.
--
-- The per-deal guardian notice (informational, not a gate) is sent from the
-- application layer, not here.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Consent-token capability table
-- ------------------------------------------------------------
create table if not exists public.guardian_consent_tokens (
  id               uuid primary key default gen_random_uuid(),
  athlete_user_id  uuid not null references public.athlete_profiles(user_id) on delete cascade,
  token_hash       text not null,
  expires_at       timestamptz not null,
  consumed_at      timestamptz,
  created_at       timestamptz not null default now()
);

comment on table public.guardian_consent_tokens is
  'Backs the emailed guardian-consent link for under-18 athletes. Stores only the SHA-256 hash of the raw token; possession of the raw token is the capability. Rows are looked up by token_hash. Future guardian-expiry cron (punch-list 2.5) purges expired, unconsumed rows.';

create index if not exists guardian_consent_tokens_hash_idx
  on public.guardian_consent_tokens (token_hash);

create index if not exists guardian_consent_tokens_athlete_idx
  on public.guardian_consent_tokens (athlete_user_id);

-- RLS on, no policy: neither anon nor authenticated may touch this table. Only
-- the service-role server routes (which bypass RLS) read or write it. A guardian
-- is not an authenticated user; they are validated by token hash server-side.
alter table public.guardian_consent_tokens enable row level security;

-- ------------------------------------------------------------
-- 2. Enforcement trigger on contracts
-- ------------------------------------------------------------
create or replace function public.enforce_guardian_consent_on_sign()
returns trigger
language plpgsql
as $$
declare
  v_is_under_18 boolean;
  v_accepted_at timestamptz;
begin
  -- Only when the athlete party is signing on THIS update (null -> not null).
  if new.athlete_signed_at is not null and old.athlete_signed_at is null then
    select ap.is_under_18, ap.guardian_accepted_at
      into v_is_under_18, v_accepted_at
      from public.athlete_profiles ap
      where ap.user_id = new.athlete_or_team_id;

    -- No athlete_profiles row => the signer is a team (or unknown): no gate.
    if found and v_is_under_18 and v_accepted_at is null then
      raise exception
        'GUARDIAN_CONSENT_REQUIRED: an under-18 athlete cannot sign until a guardian has consented'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_guardian_consent_on_sign() is
  '2.3 — blocks an under-18 athlete signature on contracts until athlete_profiles.guardian_accepted_at is set. Teams and adult athletes pass through.';

drop trigger if exists contracts_enforce_guardian_consent on public.contracts;

create trigger contracts_enforce_guardian_consent
  before update on public.contracts
  for each row execute procedure public.enforce_guardian_consent_on_sign();
