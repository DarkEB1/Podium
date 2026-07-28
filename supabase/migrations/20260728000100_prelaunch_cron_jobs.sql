-- ============================================================
-- 2.5 — THE THREE MISSING SCHEDULED JOBS
--
-- app/api/cron already had gdpr-deletion, maintenance and
-- reconcile-subscriptions. Three specified jobs were still missing. This
-- migration adds their SECURITY DEFINER entry points; the route handlers in
-- app/api/cron/* call these, and vercel.json schedules them.
--
--   1. clear_expired_chat_messages()          — spec Flow 43 (chat auto-clear)
--   2. purge_expired_guardian_consent_tokens() — spec Flow 18 (abandoned under-18)
--   3. transfer_control_for_new_adults()       — spec Flow 18 (18th birthday)
--
-- Each returns the number of rows it changed so the job can report it. Service
-- role only: the cron routes call them with the admin client, which bypasses
-- RLS, and these are SECURITY DEFINER so they run with the owner's rights.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Chat auto-clear (Flow 43)
--
-- chat_retention_days lives on athlete_profiles: it is the athlete's own "keep
-- my messages for N days" preference. A message is cleared once it is older than
-- the retention window of an athlete party to its match. Null or non-positive
-- retention means keep indefinitely, so those matches are never touched.
-- ------------------------------------------------------------
create or replace function public.clear_expired_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  with expiring as (
    select distinct m.id
    from public.messages m
    join public.matches mt on mt.id = m.match_id
    join public.athlete_profiles ap
      on ap.user_id = mt.user_a_id or ap.user_id = mt.user_b_id
    where ap.chat_retention_days is not null
      and ap.chat_retention_days > 0
      and m.created_at < now() - make_interval(days => ap.chat_retention_days)
  )
  delete from public.messages m
  using expiring e
  where m.id = e.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.clear_expired_chat_messages() is
  '2.5 / Flow 43 — deletes messages older than an athlete participant''s chat_retention_days. Null/0 retention keeps messages indefinitely.';

-- ------------------------------------------------------------
-- 2. Guardian-consent-expiry purge (Flow 18)
--
-- guardian_consent_tokens rows are single-use capability records. Once a token
-- is consumed or its expiry has passed it is spent, so it is purged. This is the
-- cleanup the guardian-consent table (20260728000000) was shaped to expect.
-- ------------------------------------------------------------
create or replace function public.purge_expired_guardian_consent_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.guardian_consent_tokens
  where consumed_at is not null
     or expires_at < now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_guardian_consent_tokens() is
  '2.5 / Flow 18 — purges consumed or expired guardian consent tokens (abandoned under-18 signups).';

-- ------------------------------------------------------------
-- 3. 18th-birthday control transfer (Flow 18)
--
-- is_under_18 is computed by a trigger on athlete_profiles.date_of_birth, but a
-- birthday is the passage of time, not a row update, so nothing recomputes it
-- when an athlete simply turns 18. This job clears the flag for anyone who has
-- now reached 18. With is_under_18 false, the guardian-consent sign gate
-- (contracts_enforce_guardian_consent) no longer applies: control transfers to
-- the now-adult athlete. It never sets the flag back to true.
-- ------------------------------------------------------------
create or replace function public.transfer_control_for_new_adults()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.athlete_profiles
  set is_under_18 = false
  where is_under_18 = true
    and date_of_birth is not null
    and date_of_birth <= current_date - interval '18 years';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.transfer_control_for_new_adults() is
  '2.5 / Flow 18 — clears is_under_18 for athletes who have reached 18, lifting the guardian-consent gate. One-way (never re-flags a minor).';
