-- ============================================================
-- B6 — TEAM / AGENT BUILD-OUT
-- Spec §5 (Team), §6 (Agent). Plan §1.5 B6.
-- Adds team_profiles sponsorship/media columns, agent verification
-- status + commission_rate, and the multi-admin team_admins table.
-- All column additions are idempotent so this is safe to re-run and
-- tolerant of base-schema columns that already exist.
-- ============================================================

-- ------------------------------------------------------------
-- TEAM PROFILES — sponsorship + media columns
-- ------------------------------------------------------------
-- media_pack_url   : optional uploaded media-pack/brief asset (spec §5A.3)
-- annual_sponsorship_target : numeric target value (spec §5A.2)
-- fan_reach        : already present in base schema; re-asserted idempotently
alter table public.team_profiles
  add column if not exists media_pack_url text;

alter table public.team_profiles
  add column if not exists annual_sponsorship_target numeric;

alter table public.team_profiles
  add column if not exists fan_reach public.fan_reach;

-- ------------------------------------------------------------
-- AGENT PROFILES — verification status + commission_rate
-- ------------------------------------------------------------
-- Tri-state verification lifecycle (spec §6A.1–6A.2): grey "Unverified",
-- amber "Pending" after applyForVerification, blue "Verified" once approved.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'agent_verification_status' and n.nspname = 'public'
  ) then
    create type public.agent_verification_status as enum (
      'unverified',
      'pending',
      'verified'
    );
  end if;
end
$$;

alter table public.agent_profiles
  add column if not exists verification_status public.agent_verification_status
    not null default 'unverified';

-- Numeric commission rate (percentage). Distinct from the existing
-- free-text commission_rate_display used for marketing copy.
alter table public.agent_profiles
  add column if not exists commission_rate numeric;

-- Backfill verification_status from the legacy is_verified flag so existing
-- rows reflect their approved state.
update public.agent_profiles
  set verification_status = 'verified'
  where is_verified = true
    and verification_status = 'unverified';

-- ============================================================
-- TEAM ADMINS — multi-admin access (spec §5B)
-- ============================================================
-- A team profile may have multiple administrators. Roles:
--   primary   — full control, billing/ownership (exactly the team owner)
--   standard  — edit profile, manage deals
--   view_only — read-only access
-- Invite lifecycle: invited -> accepted (or revoked/removed).
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'team_admin_role' and n.nspname = 'public'
  ) then
    create type public.team_admin_role as enum (
      'primary',
      'standard',
      'view_only'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'team_admin_invite_status' and n.nspname = 'public'
  ) then
    create type public.team_admin_invite_status as enum (
      'invited',
      'accepted',
      'revoked'
    );
  end if;
end
$$;

create table if not exists public.team_admins (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.team_profiles(id) on delete cascade,
  -- Nullable until an invited admin signs up / links their account.
  user_id       uuid references public.users(id) on delete cascade,
  invited_email text not null,
  full_name     text,
  role          public.team_admin_role not null default 'standard',
  invite_status public.team_admin_invite_status not null default 'invited',
  invited_by    uuid references public.users(id) on delete set null,
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One membership row per (team, email).
  constraint team_admins_team_email_unique unique (team_id, invited_email)
);

create index if not exists team_admins_team_id_idx on public.team_admins (team_id);
create index if not exists team_admins_user_id_idx on public.team_admins (user_id);

create trigger set_team_admins_updated_at
  before update on public.team_admins
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — team_admins
-- ------------------------------------------------------------
alter table public.team_admins enable row level security;

-- Helper: is the current user the owner of the given team profile?
create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_profiles tp
    where tp.id = p_team_id and tp.user_id = auth.uid()
  );
$$;

-- Read: the team owner, any admin attached to the team (by user_id), or admin.
create policy "team_admins_select"
  on public.team_admins for select
  using (
    public.is_team_owner(team_id)
    or user_id = auth.uid()
    or public.is_admin()
  );

-- Insert (invite): only the team owner may add admins to their team.
create policy "team_admins_insert"
  on public.team_admins for insert
  with check (
    public.is_team_owner(team_id)
  );

-- Update: team owner manages roles/invites; an invited user may accept
-- (update) their own row.
create policy "team_admins_update"
  on public.team_admins for update
  using (
    public.is_team_owner(team_id)
    or user_id = auth.uid()
  )
  with check (
    public.is_team_owner(team_id)
    or user_id = auth.uid()
  );

-- Delete (remove admin): only the team owner.
create policy "team_admins_delete"
  on public.team_admins for delete
  using (
    public.is_team_owner(team_id)
  );
