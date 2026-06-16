-- ============================================================
-- B4 — PRIVACY & SECURITY (plan §1.5 B4, spec §3C.4/7)
--
-- New tables: auth_2fa, active_sessions, login_history,
--             data_export_requests
-- Column add: public.users.cookie_prefs jsonb
-- RLS is enabled on EVERY new table (CLAUDE.md: no exceptions).
-- Enums owned here (no cross-pod dependency).
-- ============================================================

create type public.data_export_status as enum (
  'pending', 'processing', 'ready', 'failed', 'expired'
);

-- ============================================================
-- AUTH 2FA — one TOTP secret per user (authenticator app, spec §3C.4)
-- ============================================================

create table public.auth_2fa (
  user_id      uuid primary key references public.users(id) on delete cascade,
  secret       text not null,                 -- encrypted TOTP secret (service-role written)
  enabled      boolean not null default false,
  -- one-time recovery codes (hashed), regenerated on each enable
  recovery_codes text[] not null default '{}',
  confirmed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger set_auth_2fa_updated_at
  before update on public.auth_2fa
  for each row execute procedure public.set_updated_at();

alter table public.auth_2fa enable row level security;

-- Owner may read whether 2FA is enabled (the secret/recovery codes are never
-- exposed to the client by query design — selects in lib/supabase project away
-- sensitive columns). Writes are service-role only (enrolment/verify flow).
create policy "auth_2fa_select_own"
  on public.auth_2fa for select
  using (user_id = auth.uid() or public.is_admin());

-- INSERT/UPDATE/DELETE are service-role only (no client-side policy).

-- ============================================================
-- ACTIVE SESSIONS — one row per logged-in device (spec §3C.7)
-- ============================================================

create table public.active_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  -- opaque session identifier issued at sign-in (maps to refresh token family)
  session_token  text not null unique,
  ip_address     text,
  user_agent     text,
  device_label   text,             -- e.g. "Chrome on macOS"
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index active_sessions_user_id_idx on public.active_sessions (user_id);

alter table public.active_sessions enable row level security;

-- Owner sees own sessions; owner may revoke (delete) own sessions.
create policy "active_sessions_select_own"
  on public.active_sessions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "active_sessions_delete_own"
  on public.active_sessions for delete
  using (user_id = auth.uid());

-- INSERT/UPDATE are service-role only (issued/refreshed by auth backend).

-- ============================================================
-- LOGIN HISTORY — append-only auth event log (spec §3C.7)
-- ============================================================

create table public.login_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  success     boolean not null,
  ip_address  text,
  user_agent  text,
  location    text,            -- coarse geo, derived server-side
  created_at  timestamptz not null default now()
);

create index login_history_user_id_idx on public.login_history (user_id, created_at desc);

alter table public.login_history enable row level security;

-- Owner reads own history; admin reads all. Append-only via service role.
create policy "login_history_select_own"
  on public.login_history for select
  using (user_id = auth.uid() or public.is_admin());

-- INSERT is service-role only (auth callback). No UPDATE/DELETE (immutable log).

-- ============================================================
-- DATA EXPORT REQUESTS — GDPR right to portability (72h ZIP, spec §3C.4)
-- ============================================================

create table public.data_export_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  status        public.data_export_status not null default 'pending',
  download_url  text,                 -- presigned, populated when ready
  requested_at  timestamptz not null default now(),
  completed_at  timestamptz,
  -- export download link is valid for 72h, then the request is expired/purged
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger set_data_export_requests_updated_at
  before update on public.data_export_requests
  for each row execute procedure public.set_updated_at();

create index data_export_requests_user_id_idx
  on public.data_export_requests (user_id, requested_at desc);

alter table public.data_export_requests enable row level security;

-- Owner reads own export requests; owner may create a request for themselves.
create policy "data_export_requests_select_own"
  on public.data_export_requests for select
  using (user_id = auth.uid() or public.is_admin());

create policy "data_export_requests_insert_own"
  on public.data_export_requests for insert
  with check (user_id = auth.uid());

-- UPDATE (status/download_url) is service-role only (background job, B?/cron).

-- ============================================================
-- COOKIE PREFERENCES — consent banner state (spec §3C.4)
-- ============================================================

-- jsonb shape (app-validated): { necessary: true, analytics: bool, marketing: bool, updated_at: iso }
alter table public.users
  add column cookie_prefs jsonb;
