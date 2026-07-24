-- ============================================================
-- SEC-7 (CRITICAL) — `REVOKE ... FROM public` DOES NOT REVOKE anon/authenticated
--
-- 20260720003000_gdpr_erasure.sql:411-412 did
--     revoke all on function public.erase_user_data(uuid) from public;
--     revoke all on function public.process_scheduled_deletions(integer) from public;
-- and then granted service_role. That reads like a lockdown. It is not.
--
-- Supabase's bootstrap runs
--     alter default privileges in schema public
--       grant all on functions to postgres, anon, authenticated, service_role;
-- so every function CREATED BY postgres in schema public is born with EXPLICIT
-- `anon=X/postgres` and `authenticated=X/postgres` entries in its ACL. The
-- PUBLIC pseudo-role's implicit default EXECUTE is a SEPARATE ACL entry, and
-- `revoke ... from public` removes only that one. anon and authenticated keep
-- theirs.
--
-- Neither erasure function checked auth.uid(), and both are exposed through
-- PostgREST. So
--     POST /rest/v1/rpc/erase_user_data  {"p_user_id": "<any uuid>"}
-- with nothing but the PUBLISHABLE anon key hard-deleted an arbitrary user's
-- personal data and permanently banned their auth row. Unauthenticated,
-- unauthorised, irreversible destruction of any account in the system.
--
-- FIX: revoke EXPLICITLY from anon and authenticated, following the pattern
-- 20260720004000_auth_rate_limits.sql:107-109 already uses correctly, and
-- sweep every SECURITY DEFINER function added by the 20260720* migrations.
-- 20260720005003 additionally makes erase_user_data() refuse unauthorised
-- callers from the inside, so a future stray GRANT is not instantly fatal.
--
-- PRIVILEGE MATRIX (deliberate, per function):
--   service_role only  — erase_user_data, process_scheduled_deletions,
--                        check_rate_limit, reset_rate_limit,
--                        purge_expired_rate_limits
--                        (lib/rate-limit/index.ts and
--                         app/api/cron/maintenance/route.ts call the
--                         rate-limit ones with the service-role client, and
--                         app/api/cron/gdpr-deletion the erasure ones, so no
--                         client-side caller loses anything)
--   authenticated      — accept_proposal, counter_proposal, mark_match_read,
--                        get_conversations, can_read_user_folder
--                        (all are called from the browser session and all
--                         derive their scope from auth.uid())
--   nobody             — trigger functions; they are invoked by the trigger,
--                        never over HTTP
--
-- Re-runnable: every statement is guarded on the function and the role
-- actually existing, so this file is safe on a bare Postgres test harness.
-- ============================================================

do $$
declare
  -- SERVICE-ROLE-ONLY: revoked from anon AND authenticated.
  v_service_only text[] := array[
    'public.erase_user_data(uuid)',
    'public.process_scheduled_deletions(integer)',
    'public.check_rate_limit(text,integer,integer)',
    'public.reset_rate_limit(text)',
    'public.purge_expired_rate_limits(integer)'
  ];
  -- CLIENT-CALLABLE: revoked from anon, granted to authenticated + service_role.
  v_authenticated text[] := array[
    'public.accept_proposal(uuid)',
    'public.counter_proposal(uuid,text,numeric,public.pay_type,jsonb,text,date,date,jsonb,text)',
    'public.mark_match_read(uuid)',
    'public.get_conversations()',
    'public.can_read_user_folder(text)'
  ];
  -- TRIGGER FUNCTIONS: never reachable over HTTP; revoked from everyone.
  v_internal text[] := array[
    'public.create_match_on_connection_accepted()',
    'public.enforce_proposal_immutable_columns()'
  ];
  v_fn        text;
  v_has_anon  boolean := exists (select 1 from pg_roles where rolname = 'anon');
  v_has_auth  boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
  v_has_svc   boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  foreach v_fn in array v_service_only loop
    if to_regprocedure(v_fn) is null then
      raise notice 'SEC-7: % not present; skipped.', v_fn;
      continue;
    end if;
    execute format('revoke all on function %s from public', v_fn);
    if v_has_anon then
      execute format('revoke all on function %s from anon', v_fn);
    end if;
    if v_has_auth then
      execute format('revoke all on function %s from authenticated', v_fn);
    end if;
    if v_has_svc then
      execute format('grant execute on function %s to service_role', v_fn);
    end if;
  end loop;

  foreach v_fn in array v_authenticated loop
    if to_regprocedure(v_fn) is null then
      raise notice 'SEC-7: % not present; skipped.', v_fn;
      continue;
    end if;
    execute format('revoke all on function %s from public', v_fn);
    if v_has_anon then
      execute format('revoke all on function %s from anon', v_fn);
    end if;
    if v_has_auth then
      execute format('grant execute on function %s to authenticated', v_fn);
    end if;
    if v_has_svc then
      execute format('grant execute on function %s to service_role', v_fn);
    end if;
  end loop;

  foreach v_fn in array v_internal loop
    if to_regprocedure(v_fn) is null then
      raise notice 'SEC-7: % not present; skipped.', v_fn;
      continue;
    end if;
    execute format('revoke all on function %s from public', v_fn);
    if v_has_anon then
      execute format('revoke all on function %s from anon', v_fn);
    end if;
    if v_has_auth then
      execute format('revoke all on function %s from authenticated', v_fn);
    end if;
  end loop;
end;
$$;

-- NOTE FOR FUTURE MIGRATIONS: any new function created in schema `public` by
-- the migration role inherits anon=X / authenticated=X from Supabase's default
-- privileges. `revoke ... from public` is NOT sufficient. Always follow a new
-- SECURITY DEFINER function with an explicit
--     revoke all on function <sig> from public, anon, authenticated;
-- and then grant only the roles that genuinely need it.
