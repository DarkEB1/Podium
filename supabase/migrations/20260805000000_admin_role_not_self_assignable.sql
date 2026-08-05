-- ============================================================
-- SEC-1 — the admin role must not be self-assignable
-- ============================================================
--
-- `users_update_own` (20260419000001_users_auth.sql) enforces the role LOCK but
-- says nothing about WHICH role may be chosen. Every account starts unlocked
-- (`handle_new_user()` inserts only id and email), so its WITH CHECK reduced to
-- "you may write anything to your own row" for the whole pre-lock window. The
-- `user_role` enum includes 'admin', and `enforce_role_lock()` returns NEW
-- unchanged while `old.role_locked_at is null`, so nothing stopped:
--
--   PATCH /rest/v1/users?id=eq.<self>
--   {"role":"admin","role_locked_at":"..."}
--
-- sent with the user's own access token and the public anon key, both of which
-- ship to every browser. `getUser()` reads `public.users.role`, so the account
-- then passed every `role === 'admin'` gate, including the whole /api/admin
-- surface (approve/reject profiles, audit logs, reports). The application-layer
-- restriction in `lockRole()` / POST /api/auth/role to athlete|team|brand|agent
-- was bypassed entirely, because that write never goes through the route.
--
-- Two layers, because they cover different writers:
--   1. RLS WITH CHECK — the boundary for anything holding a user JWT.
--   2. The BEFORE UPDATE trigger — also fires for writers RLS does not apply
--      to, and is scoped to authenticated/anon JWTs so that the service role
--      (server-side provisioning, psql, backfills) can still grant admin.

-- ── 1. RLS: an unlocked user may pick any role EXCEPT admin ──────────────────

drop policy if exists "users_update_own" on public.users;

create policy "users_update_own"
  on public.users for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (
      (select u.role_locked_at from public.users u where u.id = (select auth.uid())) is null
      or (
        role = (select u.role from public.users u where u.id = (select auth.uid()))
        and role_locked_at is not null
      )
    )
    -- An existing admin keeps their role on any other self-update; nobody else
    -- may write that value. A NULL-role user writing 'admin' makes the second
    -- branch NULL, which is not TRUE, so the check fails.
    and (
      role is distinct from 'admin'
      or (select u.role from public.users u where u.id = (select auth.uid())) = 'admin'
    )
  );

-- ── 2. Trigger: same invariant for any authenticated writer ──────────────────

create or replace function public.enforce_role_lock()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  jwt_role text := '';
begin
  -- The request's JWT role claim ('authenticated', 'anon', 'service_role'), or
  -- '' for a direct connection with no PostgREST context (psql, migrations).
  begin
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  exception when others then
    jwt_role := '';
  end;

  -- SEC-1: nobody promotes themselves through a user session. Deliberately not
  -- applied to the service role, which is how a real admin gets provisioned.
  if new.role = 'admin'
     and old.role is distinct from 'admin'
     and jwt_role in ('authenticated', 'anon')
  then
    raise exception 'ADMIN_ROLE_NOT_SELF_ASSIGNABLE: the admin role can only be granted server-side'
      using errcode = 'insufficient_privilege';
  end if;

  -- L-7 (unchanged): not locked yet, this is the initial role assignment.
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

comment on function public.enforce_role_lock() is
  'L-7 role lock + SEC-1 admin-not-self-assignable. lockRole() in lib/supabase/auth.ts performs the atomic conditional UPDATE; this catches every other writer. The service role may still grant admin, which is how admins are provisioned.';

-- ── 3. Repair any account that already self-assigned admin ───────────────────
--
-- No legitimate admin is created through a user session, so an admin row whose
-- role was never granted server-side should not exist. This is a no-op on a
-- clean database; it exists because the hole was open in production.
-- Deliberately NOT automatic: dropping a real admin's access silently would be
-- worse than the hole. Run this to review, then act on the result:
--
--   select id, email, role, role_locked_at, created_at
--   from public.users where role = 'admin' order by created_at;
