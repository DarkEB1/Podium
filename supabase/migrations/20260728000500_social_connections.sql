-- ============================================================
-- Social account OAuth — connected accounts (spec §6)
--
-- Social handles were manual free-text. This stores a real OAuth connection per
-- provider so a handle can be verified and, later, follower counts synced. Access
-- tokens are stored encrypted (lib/auth/secret-crypto) and never leave the
-- server. Each provider is fail-closed: without its app credentials the connect
-- flow is unavailable.
-- ============================================================

create table if not exists public.social_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  provider            text not null,   -- 'meta' | 'tiktok' | 'x' | 'youtube' | 'linkedin'
  provider_account_id text,
  handle              text,
  access_token        text,            -- encrypted at rest
  refresh_token       text,            -- encrypted at rest, when the provider issues one
  scope               text,
  follower_count      integer,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, provider)
);

comment on table public.social_connections is
  'OAuth-connected social accounts. Tokens are encrypted at rest and server-only; one row per (user, provider).';

create index if not exists social_connections_user_idx on public.social_connections (user_id);

drop trigger if exists set_social_connections_updated_at on public.social_connections;
create trigger set_social_connections_updated_at
  before update on public.social_connections
  for each row execute procedure public.set_updated_at();

alter table public.social_connections enable row level security;

-- A user sees and removes their own connections; writes (with tokens) are service-role only.
drop policy if exists social_connections_select_own on public.social_connections;
create policy social_connections_select_own
  on public.social_connections for select
  using (user_id = auth.uid());

drop policy if exists social_connections_delete_own on public.social_connections;
create policy social_connections_delete_own
  on public.social_connections for delete
  using (user_id = auth.uid());
