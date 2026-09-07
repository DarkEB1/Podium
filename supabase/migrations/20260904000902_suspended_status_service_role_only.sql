-- WS-ADMIN-01 — make the `suspended` profile status writable only by the
-- service role.
--
-- The tables that carry `public.profile_status` (athlete_profiles,
-- team_profiles, agent_profiles) let the owner update their own row
-- (`*_profiles_update` RLS is `user_id = auth.uid()` with no column guard). That
-- is why a rejected athlete could re-publish: `publishProfile` runs under the
-- owner's JWT and sets `status = 'active'`.
--
-- This trigger blocks a JWT caller (authenticated or anon) from moving a row
-- INTO or OUT OF 'suspended'. Only the service role — which the admin routes use
-- via `createAdminClient()` — may cross that boundary, so:
--   * admin reject: service role writes  active  -> suspended   (allowed)
--   * admin re-approve: service role writes suspended -> active (allowed)
--   * athlete self-republish: JWT writes suspended -> active     (BLOCKED)
--
-- It is intentionally NARROW (only the 'suspended' transitions) so it composes
-- with, rather than duplicates, any broader status-immutability trigger.

create or replace function public.enforce_suspended_status_service_role_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  -- Defensive read: a missing or malformed claims context must never throw and
  -- lock every writer out. Mirrors admin_role_not_self_assignable.
  begin
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  exception when others then
    jwt_role := '';
  end;

  -- Only constrain end-user JWTs. The service role (and an empty/absent role,
  -- e.g. a superuser running a migration or a test) is unaffected.
  if jwt_role in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       and (new.status = 'suspended' or old.status = 'suspended') then
      raise exception 'suspended status is managed by administrators'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger athlete_profiles_suspended_lock
  before update on public.athlete_profiles
  for each row execute procedure public.enforce_suspended_status_service_role_only();

create trigger team_profiles_suspended_lock
  before update on public.team_profiles
  for each row execute procedure public.enforce_suspended_status_service_role_only();

create trigger agent_profiles_suspended_lock
  before update on public.agent_profiles
  for each row execute procedure public.enforce_suspended_status_service_role_only();
