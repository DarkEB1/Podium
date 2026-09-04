-- ============================================================
-- WS-SEC-03 — owners self-approve / self-verify / self-consent via PostgREST
-- ============================================================
--
-- The *_profiles UPDATE policies (20260419000002_profiles.sql) are
-- `using (user_id = auth.uid()) with check (user_id = auth.uid())` — they gate
-- WHICH ROW you may write, never WHICH COLUMNS, and RLS cannot: it is row-level
-- only. So a row's owner could set any column in it straight through PostgREST
-- with their own access token and the public anon key:
--
--   * a brand flips `status` to 'active', skipping admin approval;
--   * a minor athlete stamps `guardian_accepted_at` — the only field the
--     guardian-consent contract trigger checks — i.e. self-consent;
--   * an athlete forces `is_under_18` to false WITHOUT touching date_of_birth
--     (compute_is_under_18() only fires on a date_of_birth change), shedding the
--     minor-safeguarding gates;
--   * an agent sets `verification_status`='verified' / `is_verified`=true.
--
-- A BEFORE UPDATE trigger freezes these transitions for JWT callers
-- (`authenticated`/`anon`) while leaving `service_role` (admin review, the
-- guardian-consent endpoint, the age-compute path) and direct/`psql`
-- connections able to act — the same scoping as enforce_role_lock().
--
-- The guards are deliberately TABLE- and TRANSITION-specific, because some of
-- these columns are legitimately owner-writable through the authenticated
-- client and must not be frozen wholesale:
--   * athlete / team / agent self-publish `status` → 'active' via
--     publishProfile() (lib/supabase/profiles.ts). Only BRAND status is frozen
--     (publishProfile refuses brands; brand status is admin-only).
--   * an agent self-applies for verification, moving `verification_status`
--     unverified → 'pending' via applyForVerification() (lib/supabase/agents.ts).
--     Only the transition INTO the verified state is frozen.

create or replace function public.enforce_profile_privileged_columns_immutable()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  jwt_role text := '';
  oldj jsonb := to_jsonb(old);
  newj jsonb := to_jsonb(new);
begin
  -- The request's JWT role claim, read defensively: '' for a direct connection
  -- with no PostgREST context (psql, migrations, backfills).
  begin
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  exception when others then
    jwt_role := '';
  end;

  -- Only user sessions are constrained. service_role and direct connections are
  -- how these columns are legitimately written and must pass untouched.
  if jwt_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_table_name = 'athlete_profiles' then
    -- guardian_accepted_at: only the guardian-consent endpoint (service role)
    -- may stamp it; a minor self-stamping bypasses consent entirely.
    if (newj ->> 'guardian_accepted_at') is distinct from (oldj ->> 'guardian_accepted_at') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: guardian_accepted_at cannot be set through a user session'
        using errcode = 'insufficient_privilege';
    end if;
    -- is_under_18 is derived from date_of_birth. A change to it that ACCOMPANIES
    -- a date_of_birth change is compute_is_under_18() doing its job; a change
    -- ALONE is the direct self-lie, so block only that.
    if (newj ->> 'is_under_18') is distinct from (oldj ->> 'is_under_18')
       and (newj ->> 'date_of_birth') is not distinct from (oldj ->> 'date_of_birth') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: is_under_18 is derived from date_of_birth and cannot be set directly'
        using errcode = 'insufficient_privilege';
    end if;

  elsif tg_table_name = 'brand_profiles' then
    -- Brands require admin approval: status and admin_approved_* are service-role
    -- only (publishProfile refuses brands; admin review writes them).
    if (newj ->> 'status') is distinct from (oldj ->> 'status') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: brand status is set by admin review, not through a user session'
        using errcode = 'insufficient_privilege';
    end if;
    if (newj ->> 'admin_approved_at') is distinct from (oldj ->> 'admin_approved_at')
       or (newj ->> 'admin_approved_by') is distinct from (oldj ->> 'admin_approved_by') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: admin_approved_* cannot be set through a user session'
        using errcode = 'insufficient_privilege';
    end if;

  elsif tg_table_name = 'agent_profiles' then
    -- Self-apply (→ 'pending') stays allowed; GRANTING verification does not.
    if (newj ->> 'verification_status') = 'verified'
       and (newj ->> 'verification_status') is distinct from (oldj ->> 'verification_status') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: verification_status can only be set to verified by admin review'
        using errcode = 'insufficient_privilege';
    end if;
    if (newj ->> 'is_verified') = 'true'
       and (newj ->> 'is_verified') is distinct from (oldj ->> 'is_verified') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: is_verified can only be granted by admin review'
        using errcode = 'insufficient_privilege';
    end if;
    if (newj ->> 'verified_at') is not null
       and (newj ->> 'verified_at') is distinct from (oldj ->> 'verified_at') then
      raise exception
        'PROFILE_PRIVILEGED_COLUMN_IMMUTABLE: verified_at can only be set by admin review'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_privileged_columns_immutable() is
  'WS-SEC-03: freezes the self-approval columns (brand status/admin_approved_*, athlete guardian_accepted_at + direct is_under_18, agent verified-grant) against authenticated + anon writers, since per-row RLS cannot restrict columns. service_role still writes them — that is how admin approval, guardian consent and the age-compute path work. Deliberately allows athlete/team/agent self-publish of status and agent self-apply (verification_status → pending).';

-- Attached to athlete, brand and agent. team_profiles is intentionally omitted:
-- it has no self-approval columns and legitimately self-publishes its status.

drop trigger if exists athlete_profiles_privileged_columns_immutable on public.athlete_profiles;
create trigger athlete_profiles_privileged_columns_immutable
  before update on public.athlete_profiles
  for each row execute procedure public.enforce_profile_privileged_columns_immutable();

drop trigger if exists brand_profiles_privileged_columns_immutable on public.brand_profiles;
create trigger brand_profiles_privileged_columns_immutable
  before update on public.brand_profiles
  for each row execute procedure public.enforce_profile_privileged_columns_immutable();

drop trigger if exists agent_profiles_privileged_columns_immutable on public.agent_profiles;
create trigger agent_profiles_privileged_columns_immutable
  before update on public.agent_profiles
  for each row execute procedure public.enforce_profile_privileged_columns_immutable();
