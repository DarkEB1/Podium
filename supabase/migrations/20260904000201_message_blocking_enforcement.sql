-- ============================================================
-- WS-MSG-05 — BLOCKING IS ENFORCED IN RLS
--
-- `public.blocks` rows were written (POST /api/discovery/blocks) but never READ
-- by anything that matters: not by messages RLS, not by connection_requests
-- RLS, not by discovery. So "Block" was a no-op — a blocked user could still
-- open the match and message the person who blocked them, and could still fire
-- a fresh connection request at them.
--
-- FIX (this migration): teach the two INSERT policies that gate contact to
-- consult `blocks`.
--   * messages_insert          — refuse a message when EITHER participant of the
--                                match has blocked the other.
--   * connection_requests_insert — refuse a request between a pair where either
--                                side has blocked the other.
--
-- The block check is symmetric on purpose: a block must stop contact in BOTH
-- directions (the blocker should not keep messaging the person they blocked
-- either). Both checks go through SECURITY DEFINER helpers so the policy does
-- not have to re-enter RLS on `blocks` (whose own SELECT policy hides a block
-- from the blocked user — exactly the row the policy needs to see).
--
-- The companion change lives in lib/supabase/discovery.ts (blockUser also flips
-- the pair's match to status='blocked') and in the chat UI (a Block control).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers — SECURITY DEFINER so they see blocks the caller's own RLS hides.
-- ------------------------------------------------------------

-- True when a block exists between two users in EITHER direction.
create or replace function public.is_blocked_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
        or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;

comment on function public.is_blocked_between(uuid, uuid) is
  'WS-MSG-05: true when either user has blocked the other. SECURITY DEFINER so RLS on blocks (which hides a block from the blocked party) does not mask the row the caller''s INSERT policy must consult.';

-- True when the two participants of a match have a block between them.
create or replace function public.match_has_block(p_match_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
      from public.matches m
      join public.blocks b
        on (b.blocker_id = m.user_a_id and b.blocked_id = m.user_b_id)
        or (b.blocker_id = m.user_b_id and b.blocked_id = m.user_a_id)
     where m.id = p_match_id
  );
$$;

comment on function public.match_has_block(uuid) is
  'WS-MSG-05: true when either participant of the match has blocked the other. Used by messages_insert to make Block actually stop messaging.';

revoke all on function public.is_blocked_between(uuid, uuid) from public;
revoke all on function public.match_has_block(uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated, service_role;
grant execute on function public.match_has_block(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. messages_insert — same shape as 20260419000004, plus the block gate.
-- ------------------------------------------------------------
drop policy if exists "messages_insert" on public.messages;

create policy "messages_insert"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_match_participant(match_id)
    -- WS-MSG-05: a block between the participants closes the channel.
    and not public.match_has_block(match_id)
    and (
      content_type = 'proposal_card'
      or exists (
        select 1 from public.matches
        where id = match_id
        and proposal_sent = true
      )
    )
  );

comment on policy "messages_insert" on public.messages is
  'A participant may insert a proposal_card (which opens the gate) or free text once proposal_sent is true — UNLESS a block exists between the participants (WS-MSG-05).';

-- ------------------------------------------------------------
-- 3. connection_requests_insert — sender is the caller AND not blocked.
-- ------------------------------------------------------------
drop policy if exists "connection_requests_insert" on public.connection_requests;

create policy "connection_requests_insert"
  on public.connection_requests for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    -- WS-MSG-05: cannot re-open contact with someone you blocked, or who
    -- blocked you, by firing a fresh connection request.
    and not public.is_blocked_between(sender_id, recipient_id)
  );

comment on policy "connection_requests_insert" on public.connection_requests is
  'The sender must be the caller, and there must be no block in either direction between sender and recipient (WS-MSG-05).';
