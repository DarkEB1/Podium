-- ============================================================
-- L-7 — role lock enforced by the database, not by the caller
-- ============================================================
--
-- `lib/supabase/auth.ts` `lockRole()` used to read `role_locked_at`, compare it
-- in TypeScript, then issue an unconditional UPDATE. Two concurrent role-select
-- submissions both read NULL, both passed the check, and the later write won —
-- a user could end up with a role they had already been refused.
--
-- That is now a single conditional statement
-- (`... WHERE id = $2 AND role_locked_at IS NULL`), which Postgres serialises on
-- the row lock. This migration is the second line of defence, for writers that
-- statement cannot speak for:
--
--   * the RLS policy `users_update_own` (20260419000001_users_auth.sql) already
--     tries to enforce the same invariant, but it does so with a sub-SELECT in
--     its WITH CHECK clause. Under READ COMMITTED that sub-SELECT runs against
--     the statement snapshot, so a concurrent writer's freshly-committed lock is
--     not necessarily visible to it. A BEFORE UPDATE trigger reads OLD, which is
--     the re-fetched, row-locked tuple — it cannot be stale.
--   * the service-role key bypasses RLS entirely. Triggers still fire, so the
--     admin client, a psql session and a future backfill script are all covered.
--
-- Invariant: once `role_locked_at` is set, neither `role` nor `role_locked_at`
-- may change again. Idempotent, and a no-op for every UPDATE that does not touch
-- those two columns.

create or replace function public.enforce_role_lock()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  -- Not locked yet: this is the initial role assignment, allow it.
  if old.role_locked_at is null then
    return new;
  end if;

  -- Locked. Both columns are frozen from here on. `is distinct from` so a NULL
  -- role on either side is compared correctly rather than yielding NULL.
  if new.role is distinct from old.role then
    raise exception 'ROLE_ALREADY_LOCKED: role was locked at % and cannot be changed', old.role_locked_at
      using errcode = 'check_violation';
  end if;

  if new.role_locked_at is distinct from old.role_locked_at then
    raise exception 'ROLE_ALREADY_LOCKED: role_locked_at is immutable once set'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_role_lock on public.users;

create trigger enforce_role_lock
  before update of role, role_locked_at on public.users
  for each row
  execute function public.enforce_role_lock();

comment on function public.enforce_role_lock() is
  'L-7: makes the role lock a database invariant. lockRole() in lib/supabase/auth.ts performs the atomic conditional UPDATE; this catches every other writer, including the service role, which bypasses RLS.';
