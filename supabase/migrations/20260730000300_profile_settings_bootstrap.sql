-- ============================================================
-- QA-1.5 — EVERY USER GETS A profile_settings ROW
--
-- profile_settings holds the notification matrix and the marketing opt-in, and
-- every transactional email checks it before sending: sendTransactionalEmail ->
-- emailAllowed -> getSettings, which read the row with .single() and threw when
-- there was none.
--
-- Nothing ever created that row. The table (20260616000003) has an updated_at
-- trigger and an RLS insert policy but no insert trigger, and no application
-- code path writes the initial row, so the table was empty for every user in the
-- system. Every send therefore threw before it could decide whether to send.
-- The email layer catches and reports rather than breaking the caller's
-- transaction, which is why connection requests and proposals kept working and
-- nobody noticed that no email had ever gone out.
--
-- Two halves, both needed. Here: the row now exists for everyone, created with
-- the user and backfilled for existing accounts. In lib/supabase/settings.ts:
-- getSettings falls back to the column defaults instead of throwing, so a
-- missing row can never again take the whole notification path down.
--
-- Keyed on public.users rather than auth.users so it covers both the auth
-- mirror trigger (on_auth_user_created) and any direct insert, e.g. the seed.
-- ============================================================

create or replace function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- All columns are defaulted; user_id is the only value that matters. ON
  -- CONFLICT keeps this harmless if a row was already created another way.
  insert into public.profile_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user_settings() is
  'QA-1.5: creates the profile_settings row a user needs before any notification or email preference can be read.';

drop trigger if exists on_user_created_settings on public.users;

create trigger on_user_created_settings
  after insert on public.users
  for each row execute procedure public.handle_new_user_settings();

-- Backfill: every account that existed before this trigger, which is all of
-- them. Defaults only, so nobody's preferences are invented for them.
insert into public.profile_settings (user_id)
select u.id
  from public.users u
  left join public.profile_settings ps on ps.user_id = u.id
 where ps.user_id is null;
