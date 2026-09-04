-- ============================================================
-- WS-MSG-08 — TYPING / READ-RECEIPT / PRESENCE CHANNELS ARE AUTHORIZED
--
-- lib/realtime/index.ts opens two channels per match:
--     typing:<matchId>     (broadcast — typing + read receipts)
--     presence:<matchId>   (presence  — the online dot)
-- Both were PUBLIC channels: anyone holding the anon key and a match id could
-- subscribe and forge "read", "typing" and presence events at either
-- participant. Presence in particular leaks that a user (possibly a minor) is
-- online, in real time, to a stranger.
--
-- FIX has two halves:
--   1. lib/realtime/index.ts marks both channels `{ config: { private: true } }`
--      so the client authorizes against RLS before it can join.
--   2. (this migration) a Realtime Authorization policy on `realtime.messages`
--      that lets ONLY the two match participants read/write those topics. The
--      match id is parsed out of the topic and checked with the existing
--      is_match_participant() helper — the same predicate that guards the
--      messages themselves — so authorization is scoped to auth.uid().
--
-- realtime.messages is owned by supabase_realtime_admin; as with the storage
-- policies (20260720005002), the DDL is wrapped so a missing table or a
-- privilege error downgrades to a warning instead of aborting the migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: may the caller join this match channel?
--
-- SECURITY DEFINER so it does not have to re-enter RLS, but authorization still
-- keys off auth.uid() via is_match_participant. Takes the raw topic text; a
-- malformed topic or a non-uuid segment returns false rather than raising.
-- ------------------------------------------------------------
create or replace function public.can_access_match_channel(p_topic text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_prefix text;
  v_match  text;
  v_id     uuid;
begin
  if p_topic is null then
    return false;
  end if;

  v_prefix := split_part(p_topic, ':', 1);
  v_match  := split_part(p_topic, ':', 2);

  -- Only the messaging channels this app opens are authorizable here.
  if v_prefix not in ('typing', 'presence') then
    return false;
  end if;

  begin
    v_id := v_match::uuid;
  exception when others then
    return false;
  end;

  return public.is_match_participant(v_id);
end;
$$;

comment on function public.can_access_match_channel(text) is
  'WS-MSG-08: true when auth.uid() is a participant of the match encoded in a `typing:<id>` / `presence:<id>` Realtime topic. Backs the realtime.messages authorization policy. Returns false (never raises) for a malformed topic.';

revoke all on function public.can_access_match_channel(text) from public;
grant execute on function public.can_access_match_channel(text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. realtime.messages authorization policies (private-channel gate).
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'WS-MSG-08: realtime.messages not present; skipping realtime authorization policies.';
    return;
  end if;

  -- Receiving broadcast/presence on the topic.
  execute 'drop policy if exists "podium_realtime_match_channel_read" on realtime.messages';
  execute
    'create policy "podium_realtime_match_channel_read"
       on realtime.messages for select
       to authenticated
       using ( public.can_access_match_channel((select realtime.topic())) )';

  -- Sending broadcast/presence on the topic.
  execute 'drop policy if exists "podium_realtime_match_channel_write" on realtime.messages';
  execute
    'create policy "podium_realtime_match_channel_write"
       on realtime.messages for insert
       to authenticated
       with check ( public.can_access_match_channel((select realtime.topic())) )';
exception
  when insufficient_privilege then
    raise warning 'WS-MSG-08: no privilege on realtime.messages (needs supabase_realtime_admin); realtime authorization policies were NOT applied. Apply them from the Supabase dashboard.';
  when undefined_function then
    raise warning 'WS-MSG-08: realtime.topic() unavailable; realtime authorization policies were NOT applied.';
end;
$$;
