-- =============================================================================
-- L-6 / DI-3 — application deadlines actually take effect
-- =============================================================================
-- `job_listings.application_deadline` (timestamptz, 20260419000003_discovery.sql)
-- was written by the listing form and read back by the discovery query, but was
-- never used as a filter. An opportunity whose deadline passed months ago stayed
-- in the athlete and team feeds and still accepted applications.
--
-- Enforcement is split deliberately:
--
--   1. The FEED PREDICATE in lib/supabase/discovery.ts (getActiveListingsPage)
--      is authoritative. It is a computed predicate, so it is correct the
--      instant a deadline passes and stays correct even if no scheduled job
--      ever runs. This index exists to make that predicate cheap.
--
--   2. The STATUS TRANSITION below (active -> expired) is bookkeeping for the
--      brand's own dashboard and for reporting. It is optional, bounded and
--      REVERSIBLE: `expired` is an existing value of public.listing_status
--      (20260419000001_users_auth.sql) and a brand can move a listing back.
--
-- Deliberately NOT done, per the "deadline cascade" note in DI-3: nothing here
-- deletes a listing, cascades into connection_requests / matches / proposals, or
-- mass-mutates any other table. Archiving is reversible by product decision, so
-- an irreversible sweep is not an acceptable implementation of a deadline.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Index supporting the discovery feed predicate
-- -----------------------------------------------------------------------------
-- job_listings carried NO indexes at all before this migration, so the feed was
-- a sequential scan even on status alone.
--
-- The feed query is:
--   where status = 'active'
--     and (application_deadline is null or application_deadline >= <cutoff>)
--   order by created_at desc
--   limit ...
--
-- The partial index restricts to the only status the feed reads, and leads on
-- created_at desc so the ORDER BY + LIMIT is answered straight from the index.
-- application_deadline rides along as a second key so the deadline half of the
-- predicate is filtered inside the index scan rather than by a heap re-check.
create index if not exists job_listings_active_feed_idx
  on public.job_listings (created_at desc, application_deadline)
  where status = 'active';

comment on index public.job_listings_active_feed_idx is
  'Discovery feed (L-6): active listings ordered newest-first, deadline available in-index for the not-yet-expired predicate.';

-- -----------------------------------------------------------------------------
-- expire_listings_past_deadline — bounded, reversible status sweep
-- -----------------------------------------------------------------------------
-- Moves listings whose deadline has passed from 'active' to 'expired'.
--
-- Semantics match the feed predicate exactly: application_deadline is a
-- timestamptz, but its only writer is an <input type="date"> which stores
-- midnight UTC at the START of the chosen day. Comparing against now() would
-- expire a listing at 00:00 on its own deadline day. The cutoff is therefore
-- date_trunc('day', now() at time zone 'utc'), i.e. the deadline is INCLUSIVE
-- of its own day and the listing closes at 00:00 UTC the day after.
--
-- Idempotent: rows already 'expired' no longer match the WHERE clause, so
-- re-running is a no-op. Bounded by p_limit so it cannot lock the table for an
-- unbounded time or blow a job's time budget; a caller that wants the whole
-- backlog cleared runs it until it returns 0.
--
-- Not wired to a schedule by this migration. The feed predicate already makes
-- expired listings invisible, so this is safe to leave unscheduled; wiring it
-- into app/api/cron/maintenance is a one-line RPC call whenever that route's
-- owner wants the status column to agree with the predicate.
create or replace function public.expire_listings_past_deadline(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
-- Pinned so a caller-controlled search_path cannot redirect this write.
set search_path = public, pg_temp
as $$
declare
  v_cutoff  timestamptz := date_trunc('day', (now() at time zone 'utc')) at time zone 'utc';
  v_updated integer;
begin
  -- Guard against a caller passing 0 or a negative bound and silently doing
  -- nothing, or passing a huge bound and holding row locks for minutes.
  if p_limit is null or p_limit < 1 then
    p_limit := 1;
  elsif p_limit > 5000 then
    p_limit := 5000;
  end if;

  with due as (
    select id
    from public.job_listings
    where status = 'active'
      and application_deadline is not null
      and application_deadline < v_cutoff
    order by application_deadline
    limit p_limit
    -- Two concurrent invocations must not both claim the same rows.
    for update skip locked
  )
  update public.job_listings l
     set status = 'expired'
    from due
   where l.id = due.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.expire_listings_past_deadline(integer) is
  'L-6/DI-3: bounded, idempotent, reversible active -> expired transition for listings past their application deadline. Never deletes or cascades.';

-- Service role only. This is a maintenance job, not something an authenticated
-- brand or athlete may trigger.
revoke all on function public.expire_listings_past_deadline(integer) from public;
revoke all on function public.expire_listings_past_deadline(integer) from anon;
revoke all on function public.expire_listings_past_deadline(integer) from authenticated;
