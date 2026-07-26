-- ============================================================
-- SB-3 / L-3 — INBOX IN ONE QUERY + REAL UNREAD COUNTS
--
-- `getConversations()` used to run, per match: up to 4 profile-table probes
-- (there is no single `profiles` table) plus a last-message query — roughly
-- 5 round-trips per conversation, ~100 for a 20-conversation inbox. And
-- `unreadCount` was hardcoded to 0 because the schema had no read tracking.
--
-- This migration adds:
--   1. public.participant_display  — UNION ALL name/avatar resolution view
--   2. public.message_reads        — per (match, user) read watermark (RLS)
--   3. public.mark_match_read()    — upsert the watermark
--   4. public.get_conversations()  — the whole inbox in ONE call
-- ============================================================

-- ------------------------------------------------------------
-- 1. Display-name / avatar resolution across the four profile tables.
--
-- Internal helper only: it is consumed from inside the SECURITY DEFINER
-- function below, so it is NOT granted to anon/authenticated.
-- ------------------------------------------------------------
drop view if exists public.participant_display;

create view public.participant_display as
  select
    user_id,
    coalesce(nullif(display_name, ''), 'Athlete') as display_name,
    profile_photo_url                            as avatar_url
  from public.athlete_profiles
  union all
  select
    user_id,
    coalesce(nullif(trading_name, ''), company_name) as display_name,
    logo_url                                         as avatar_url
  from public.brand_profiles
  union all
  select
    user_id,
    coalesce(nullif(team_name, ''), 'Team') as display_name,
    logo_url                                as avatar_url
  from public.team_profiles
  union all
  select
    user_id,
    coalesce(nullif(agency_name, ''), nullif(agent_full_name, ''), 'Agent') as display_name,
    logo_url                                                               as avatar_url
  from public.agent_profiles;

comment on view public.participant_display is
  'SB-3: one row per profile giving a user''s display name + avatar, whatever their role. Internal helper for public.get_conversations(); intentionally not granted to client roles.';

revoke all on public.participant_display from anon, authenticated;

-- ------------------------------------------------------------
-- 2. Read watermarks (L-3)
-- ------------------------------------------------------------
create table if not exists public.message_reads (
  match_id     uuid not null references public.matches(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (match_id, user_id)
);

comment on table public.message_reads is
  'L-3: per-conversation read watermark. Unread = messages in the match with sent_at > last_read_at and sender_id <> the reader.';

drop trigger if exists set_message_reads_updated_at on public.message_reads;

create trigger set_message_reads_updated_at
  before update on public.message_reads
  for each row execute procedure public.set_updated_at();

alter table public.message_reads enable row level security;

-- Owner-only: a watermark is private to the user it belongs to.
drop policy if exists "message_reads_select" on public.message_reads;
create policy "message_reads_select"
  on public.message_reads for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "message_reads_insert" on public.message_reads;
create policy "message_reads_insert"
  on public.message_reads for insert
  with check (
    user_id = auth.uid()
    and public.is_match_participant(match_id)
  );

drop policy if exists "message_reads_update" on public.message_reads;
create policy "message_reads_update"
  on public.message_reads for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "message_reads_delete" on public.message_reads;
create policy "message_reads_delete"
  on public.message_reads for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. mark_match_read(p_match_id)
-- ------------------------------------------------------------
create or replace function public.mark_match_read(p_match_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_now    timestamptz := now();
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = 'PD001';
  end if;

  if not exists (
    select 1 from public.matches
     where id = p_match_id
       and (user_a_id = v_caller or user_b_id = v_caller)
  ) then
    raise exception 'Not a participant in this match' using errcode = 'PD005';
  end if;

  insert into public.message_reads (match_id, user_id, last_read_at)
  values (p_match_id, v_caller, v_now)
  on conflict (match_id, user_id)
  do update set last_read_at = excluded.last_read_at;

  return v_now;
end;
$$;

comment on function public.mark_match_read(uuid) is
  'L-3: moves the caller''s read watermark on a match to now(). Caller must be a match participant.';

revoke all on function public.mark_match_read(uuid) from public;
grant execute on function public.mark_match_read(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4. get_conversations() — the entire inbox in ONE query.
--
-- SECURITY DEFINER so it can read the counterparty's profile row and the
-- message table without four extra client round-trips; every row is scoped
-- to auth.uid() by the my_matches CTE, so no other user's inbox is reachable.
-- ------------------------------------------------------------
create or replace function public.get_conversations()
returns table (
  match_id          uuid,
  other_user_id     uuid,
  display_name      text,
  avatar_url        text,
  last_message_text text,
  last_message_type text,
  last_message_at   timestamptz,
  matched_at        timestamptz,
  unread_count      integer
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
      coalesce(m.matched_at, m.created_at) as matched_at
    from public.matches m
    where m.status = 'active'
      and auth.uid() is not null
      and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
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
    coalesce(uc.unread_count, 0)
  from my_matches mm
  -- LATERAL + LIMIT 1: a user could in theory hold more than one profile row.
  left join lateral (
    select p.display_name, p.avatar_url
    from public.participant_display p
    where p.user_id = mm.other_id
    limit 1
  ) pd on true
  left join lateral (
    select msg.text_content, msg.content_type, msg.sent_at
    from public.messages msg
    where msg.match_id = mm.id
      and msg.is_deleted = false
    order by msg.sent_at desc
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
  order by coalesce(lm.sent_at, mm.matched_at) desc;
$$;

comment on function public.get_conversations() is
  'SB-3/L-3: returns the caller''s whole inbox (counterparty name/avatar, last message preview, unread count) in a single query. Replaces the per-match N+1 in lib/supabase/messaging.ts.';

revoke all on function public.get_conversations() from public;
grant execute on function public.get_conversations() to authenticated, service_role;

-- Supports the last-message and unread-count lateral joins.
create index if not exists messages_match_id_sent_at_idx
  on public.messages (match_id, sent_at desc);
