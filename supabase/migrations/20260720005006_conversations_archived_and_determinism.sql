-- ============================================================
-- SEC-9 — INBOX: REACHABLE ARCHIVED CONVERSATIONS + DETERMINISTIC IDENTITY
--
-- Supersedes public.participant_display and public.get_conversations() from
-- 20260720001004_inbox_and_message_reads.sql (untouched).
--
-- DEFECT H — archived conversations were unreachable.
--   20260720001004:171 hard-codes `where m.status = 'active'` with no way to
--   ask for anything else, while 20260720001000:140-147 documents archiving as
--   REVERSIBLE. A client that archives a match can therefore never find it
--   again to un-archive it: the row is invisible to the only inbox query there
--   is. FIX: `p_include_archived boolean default false`. The default preserves
--   the existing zero-argument call (`rpc('get_conversations')`), so no caller
--   breaks; 'blocked' is never returned either way.
--   NOTE: the old zero-argument function is DROPPED first. Creating the
--   defaulted version alongside it would leave two candidates for a no-arg
--   call and PostgREST would fail with 42725 (function is not unique).
--
-- DEFECT L — the counterparty's name/avatar was non-deterministic.
--   The `left join lateral (... limit 1)` correctly avoids duplicating rows
--   when a user holds more than one profile row, but it has NO ORDER BY, so
--   which profile wins is whatever the plan happens to produce. A user with,
--   say, both an athlete and an agent profile could see the same conversation
--   named differently between two loads of the same page. FIX: give
--   participant_display an explicit `source_priority` (athlete > brand > team >
--   agent, matching the primary-role order in public.user_role) and order the
--   lateral by it, with user_id/display_name as a final tiebreak so the result
--   is total.
-- ============================================================

-- ------------------------------------------------------------
-- 1. participant_display — now carries a deterministic priority.
-- ------------------------------------------------------------
drop view if exists public.participant_display;

create view public.participant_display as
  select
    user_id,
    coalesce(nullif(display_name, ''), 'Athlete') as display_name,
    profile_photo_url                            as avatar_url,
    1                                            as source_priority
  from public.athlete_profiles
  union all
  select
    user_id,
    coalesce(nullif(trading_name, ''), company_name) as display_name,
    logo_url                                         as avatar_url,
    2                                                as source_priority
  from public.brand_profiles
  union all
  select
    user_id,
    coalesce(nullif(team_name, ''), 'Team') as display_name,
    logo_url                                as avatar_url,
    3                                       as source_priority
  from public.team_profiles
  union all
  select
    user_id,
    coalesce(nullif(agency_name, ''), nullif(agent_full_name, ''), 'Agent') as display_name,
    logo_url                                                               as avatar_url,
    4                                                                      as source_priority
  from public.agent_profiles;

comment on view public.participant_display is
  'SB-3/SEC-9: one row per profile giving a user''s display name + avatar, whatever their role. source_priority makes the pick deterministic when a user holds more than one profile row. Internal helper for public.get_conversations(); intentionally not granted to client roles.';

revoke all on public.participant_display from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.participant_display from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.participant_display from authenticated';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. get_conversations(p_include_archived boolean default false)
-- ------------------------------------------------------------
drop function if exists public.get_conversations();
drop function if exists public.get_conversations(boolean);

create function public.get_conversations(p_include_archived boolean default false)
returns table (
  match_id          uuid,
  other_user_id     uuid,
  display_name      text,
  avatar_url        text,
  last_message_text text,
  last_message_type text,
  last_message_at   timestamptz,
  matched_at        timestamptz,
  unread_count      integer,
  match_status      text
)
language sql
security definer set search_path = public
stable
as $$
  with my_matches as (
    select
      m.id,
      auth.uid() as me,
      case when m.user_a_id = auth.uid() then m.user_b_id else m.user_a_id end as other_id,
      coalesce(m.matched_at, m.created_at) as matched_at,
      m.status
    from public.matches m
    where auth.uid() is not null
      and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
      -- 'blocked' is never surfaced in the inbox.
      and (
        m.status = 'active'
        or (coalesce(p_include_archived, false) and m.status = 'archived')
      )
  )
  select
    mm.id,
    mm.other_id,
    coalesce(pd.display_name, 'Conversation'),
    pd.avatar_url,
    lm.text_content,
    lm.content_type::text,
    lm.sent_at,
    mm.matched_at,
    coalesce(uc.unread_count, 0),
    mm.status::text
  from my_matches mm
  -- LATERAL + LIMIT 1: a user could hold more than one profile row. ORDER BY
  -- makes which one wins stable across calls (SEC-9 / defect L).
  left join lateral (
    select p.display_name, p.avatar_url
    from public.participant_display p
    where p.user_id = mm.other_id
    order by p.source_priority asc, p.display_name asc
    limit 1
  ) pd on true
  left join lateral (
    select msg.text_content, msg.content_type, msg.sent_at
    from public.messages msg
    where msg.match_id = mm.id
      and msg.is_deleted = false
    order by msg.sent_at desc, msg.id desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*)::integer as unread_count
    from public.messages msg
    where msg.match_id = mm.id
      and msg.is_deleted = false
      and msg.sender_id <> mm.me
      and msg.sent_at > coalesce(
        (
          select r.last_read_at
          from public.message_reads r
          where r.match_id = mm.id
            and r.user_id = mm.me
        ),
        '-infinity'::timestamptz
      )
  ) uc on true
  order by coalesce(lm.sent_at, mm.matched_at) desc, mm.id desc;
$$;

comment on function public.get_conversations(boolean) is
  'SB-3/L-3/SEC-9: the caller''s whole inbox in one query. p_include_archived adds archived matches so DI-3 un-archiving is actually reachable from the client; blocked matches are never returned. Counterparty identity is resolved deterministically via participant_display.source_priority.';

revoke all on function public.get_conversations(boolean) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.get_conversations(boolean) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.get_conversations(boolean) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.get_conversations(boolean) to service_role';
  end if;
end;
$$;
