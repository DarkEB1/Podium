-- =============================================================================
-- DH-2 / SEC-2 — Rate limiting for auth and state-changing endpoints
-- =============================================================================
-- The auth endpoints (login, signup, password reset) had NO rate limiting, so
-- credential stuffing and password brute-forcing were unthrottled, and the
-- password-reset endpoint could be used to mail-bomb an address.
--
-- Why this lives in Postgres rather than in process memory: the app runs on
-- Vercel serverless, where every instance has its own heap and instances are
-- created and destroyed per traffic. An in-memory counter therefore only
-- throttles an attacker who happens to land on the same instance twice — which
-- an attacker never needs to do. A shared store is the only correct option, and
-- Postgres is already a dependency, so this avoids adding Redis/KV.
--
-- The counter uses a fixed window. That permits a burst of at most 2x the limit
-- across a window boundary, which is an accepted trade-off here: the goal is to
-- make sustained brute force impractical, not to police exact request rates.
-- =============================================================================

create table if not exists public.auth_rate_limits (
  -- '<action>:<identifier>', e.g. 'login:ip:1.2.3.4' or 'login:email:a@b.com'
  key            text        primary key,
  window_started timestamptz not null default now(),
  attempts       integer     not null default 0,
  updated_at     timestamptz not null default now()
);

comment on table public.auth_rate_limits is
  'DH-2/SEC-2: shared fixed-window counters for auth throttling. Written only by the service role via check_rate_limit(). Rows are disposable — safe to truncate.';

-- Lets the cleanup job find expired windows without a full scan.
create index if not exists auth_rate_limits_window_idx
  on public.auth_rate_limits (window_started);

-- No client may read or write these counters: knowing your own remaining
-- attempts is information an attacker benefits from, and a writable counter is
-- a bypass. RLS on with zero policies = service-role-only access.
alter table public.auth_rate_limits enable row level security;

-- -----------------------------------------------------------------------------
-- check_rate_limit — atomically consume one attempt against a key.
-- -----------------------------------------------------------------------------
-- Returns the decision plus the seconds until the window resets, so the caller
-- can send a truthful Retry-After header.
--
-- Atomicity matters: two concurrent requests must not both read "4 attempts"
-- and both write "5". The INSERT .. ON CONFLICT DO UPDATE is a single statement
-- and takes a row lock, so concurrent callers serialise on the key.
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, attempts integer, retry_after integer)
language plpgsql
security definer
-- Pinned so a caller-controlled search_path cannot redirect these writes.
set search_path = public, pg_temp
as $$
declare
  v_now            timestamptz := now();
  v_window_started timestamptz;
  v_attempts       integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'check_rate_limit: limit and window must be positive'
      using errcode = 'PD100';
  end if;

  insert into public.auth_rate_limits as arl (key, window_started, attempts, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set
      -- Expired window: start a fresh one. Otherwise increment in place.
      window_started = case
        when arl.window_started < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else arl.window_started
      end,
      attempts = case
        when arl.window_started < v_now - make_interval(secs => p_window_seconds)
          then 1
        else arl.attempts + 1
      end,
      updated_at = v_now
  returning arl.window_started, arl.attempts
  into v_window_started, v_attempts;

  return query
  select
    v_attempts <= p_limit,
    v_attempts,
    greatest(
      0,
      ceil(
        extract(epoch from (v_window_started + make_interval(secs => p_window_seconds) - v_now))
      )::integer
    );
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is
  'DH-2/SEC-2: atomically consume one attempt against a fixed window. Returns (allowed, attempts, retry_after seconds).';

-- Only the service role calls this. Exposing it to anon/authenticated would let
-- a client burn another identifier''s budget (a denial-of-service primitive).
revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, integer, integer) from authenticated;

-- -----------------------------------------------------------------------------
-- reset_rate_limit — clear a key after a legitimate success.
-- -----------------------------------------------------------------------------
-- A user who signs in correctly should not stay near their limit because of
-- earlier typos.
create or replace function public.reset_rate_limit(p_key text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.auth_rate_limits where key = p_key;
$$;

revoke all on function public.reset_rate_limit(text) from public;
revoke all on function public.reset_rate_limit(text) from anon;
revoke all on function public.reset_rate_limit(text) from authenticated;

-- -----------------------------------------------------------------------------
-- purge_expired_rate_limits — housekeeping.
-- -----------------------------------------------------------------------------
-- Without this the table grows one row per distinct IP forever. Called by the
-- existing cron route; safe to run at any time.
create or replace function public.purge_expired_rate_limits(p_older_than_seconds integer default 86400)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.auth_rate_limits
  where window_started < now() - make_interval(secs => p_older_than_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_rate_limits(integer) from public;
revoke all on function public.purge_expired_rate_limits(integer) from anon;
revoke all on function public.purge_expired_rate_limits(integer) from authenticated;
