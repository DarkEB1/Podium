-- ============================================================
-- ALL ENUMS (defined here, referenced across all migrations)
-- ============================================================

create type public.user_role as enum (
  'athlete', 'team', 'brand', 'agent', 'admin'
);
create type public.profile_status as enum (
  'draft', 'pending_review', 'active', 'deactivated'
);
create type public.brand_status as enum (
  'pending_approval', 'active', 'suspended', 'rejected'
);
create type public.ui_mode as enum ('marketplace', 'swipe');
create type public.display_theme as enum ('light', 'dark');
create type public.athlete_level as enum (
  'recreational', 'amateur', 'semi_professional', 'professional', 'international'
);
create type public.team_level as enum (
  'grassroots', 'college', 'semi_pro', 'professional', 'international'
);
create type public.brand_industry as enum (
  'sport', 'fashion', 'nutrition', 'technology', 'financial',
  'travel', 'entertainment', 'fmcg', 'other'
);
create type public.availability_status as enum (
  'available_now', 'available_from', 'not_available'
);
create type public.fan_reach as enum ('local', 'regional', 'national', 'international');
create type public.link_status as enum ('pending', 'active', 'terminated');
create type public.listing_type as enum ('athlete_endorsement', 'team_sponsorship');
create type public.listing_status as enum (
  'draft', 'active', 'paused', 'expired', 'filled'
);
create type public.pay_type as enum (
  'flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'
);
create type public.connection_status as enum (
  'pending', 'accepted', 'declined', 'withdrawn'
);
create type public.match_status as enum ('active', 'archived', 'blocked');
create type public.message_type as enum (
  'text', 'image', 'video', 'document',
  'proposal_card', 'esignature_request', 'payment_confirmation'
);
create type public.proposal_status as enum (
  'pending', 'accepted', 'declined', 'countered', 'withdrawn'
);
create type public.contract_status as enum (
  'draft', 'pending_brand_signature', 'pending_athlete_signature',
  'fully_signed', 'terminated'
);
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'paused'
);
create type public.payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'refunded'
);
create type public.notification_channel as enum ('push', 'email', 'in_app');
create type public.report_reason as enum (
  'fake_profile', 'inappropriate_content', 'harassment',
  'spam', 'underage_concern', 'other'
);
create type public.report_status as enum (
  'pending', 'under_review', 'resolved', 'dismissed'
);

-- ============================================================
-- SHARED TRIGGER FUNCTIONS (reused by all subsequent migrations)
-- ============================================================

-- Automatically updates updated_at on any row change.
-- Called via: create trigger ... execute procedure public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Populates public.users when a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Returns true if the current authenticated user has the admin role.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- ============================================================
-- USERS TABLE
-- ============================================================

create table public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  role                    public.user_role,
  role_locked_at          timestamptz,
  email_verified          boolean not null default false,
  terms_accepted_at       timestamptz,
  terms_version           text,
  privacy_accepted_at     timestamptz,
  privacy_version         text,
  deactivated_at          timestamptz,
  deletion_requested_at   timestamptz,
  deletion_scheduled_at   timestamptz,
  data_export_requested_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger set_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

-- Fires when a user registers via Supabase Auth — mirrors row into public.users.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RLS — USERS
-- ============================================================

alter table public.users enable row level security;

-- Own row only
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

-- Own row, with role-lock protection:
--   If role_locked_at is NULL in the DB: allow any update (initial role set)
--   If role_locked_at is NOT NULL: role must stay the same AND role_locked_at must stay set
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      (select role_locked_at from public.users where id = auth.uid()) is null
      or (
        role = (select role from public.users where id = auth.uid())
        and role_locked_at is not null
      )
    )
  );

-- No INSERT from client (trigger-only population)
-- No DELETE (use deactivated_at / deletion_scheduled_at)
