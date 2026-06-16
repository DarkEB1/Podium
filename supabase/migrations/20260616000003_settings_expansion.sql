-- ============================================================
-- B3 — SETTINGS EXPANSION (plan §1.5 B3, spec §3C.2/3/4)
--
-- Introduces public.profile_settings: one row per user holding the
-- cross-role settings surface (notifications, quiet hours, digest,
-- marketing, visibility/discovery, location precision, match pausing,
-- display currency). One table keyed on user_id keeps settings shared
-- across whichever role profile the user owns.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.email_digest as enum ('daily', 'weekly', 'off');
create type public.location_precision as enum ('city', 'region', 'country');
create type public.display_currency as enum ('gbp', 'usd', 'eur');

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
create table public.profile_settings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.users(id) on delete cascade,

  -- Notifications (spec §3C.3)
  -- notification_matrix: per-event channel preferences, e.g.
  --   { "new_match": { "push": true, "in_app": true, "email": false }, ... }
  notification_matrix jsonb not null default '{}',
  quiet_hours_start   time,
  quiet_hours_end     time,
  email_digest        public.email_digest not null default 'off',
  marketing_opt_in    boolean not null default false,

  -- Visibility / discovery (spec §3C.2)
  profile_visible     boolean not null default true,
  discoverable        boolean not null default true,
  -- section_visibility: per-section overrides, e.g.
  --   { "stats": true, "social": true, "contact": false }
  section_visibility  jsonb not null default '{}',
  location_precision  public.location_precision not null default 'city',
  pause_matches       boolean not null default false,

  -- Payments display (spec §3C.5)
  display_currency    public.display_currency not null default 'gbp',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger set_profile_settings_updated_at
  before update on public.profile_settings
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — owner-scoped (admins may read for support)
-- ------------------------------------------------------------
alter table public.profile_settings enable row level security;

create policy "profile_settings_select"
  on public.profile_settings for select
  using (user_id = auth.uid() or public.is_admin());

create policy "profile_settings_insert"
  on public.profile_settings for insert
  with check (user_id = auth.uid());

create policy "profile_settings_update"
  on public.profile_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
