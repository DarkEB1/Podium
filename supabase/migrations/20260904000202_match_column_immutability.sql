-- ============================================================
-- WS-MSG-06 — matches.proposal_sent (AND status) CANNOT BE FORGED BY A PATCH
--
-- matches gates free-text chat behind proposal_sent. The matches_update policy
-- (SEC-8, 20260720005005) intentionally lets a participant write proposal_sent
-- and status so the app can flip the gate and archive/unarchive. But "let a
-- participant write proposal_sent" is exactly the hole: ANY participant could
--     patch /matches?id=eq.<theirs> {"proposal_sent": true}
-- straight through PostgREST and unlock free-text messaging without a brand ever
-- sending a proposal. The gate's whole point evaporates.
--
-- The immutability of a match is a per-COLUMN question, not a per-row one, and
-- only a BEFORE UPDATE trigger can express it (a WITH CHECK only sees the
-- post-update row; RLS cannot say "you may write this column only as a side
-- effect of a legitimate flow"). This extends the SEC-8 participant-pinning
-- trigger into a single column-immutability trigger.
--
-- proposal_sent:
--   * never re-closes (true -> false is rejected);
--   * opens (false -> true) only when a proposal actually EXISTS for the match —
--     a proposals row, or a proposal_card message. That is precisely the state
--     the two legitimate flows leave behind before they flip the gate:
--       - send_proposal() (20260730000200) inserts the proposals row in the SAME
--         transaction, then flips — the row is visible to the trigger;
--       - sendMessage() (lib/supabase/messaging.ts) inserts the proposal_card
--         MESSAGE first, then flips — the message is already committed.
--     A bare PATCH that flips the gate with nothing sent has neither, so it is
--     rejected. The service role is exempt (ops / admin remediation).
--
-- status:
--   * 'blocked' is terminal for a participant (SEC-8 / WS-MSG-05): only the
--     service role may move a match OUT of blocked. A participant PATCH cannot
--     silently revive a blocked messaging channel. Moving INTO blocked, and
--     active<->archived, stay open (archiving is reversible, DI-3; blockUser
--     sets status='blocked').
--
-- Style mirrors admin_role_not_self_assignable (20260805000000): the JWT role is
-- read defensively so a missing/malformed request context cannot throw inside
-- the trigger, and the service_role is never blocked.
-- ============================================================

create or replace function public.enforce_match_immutable_columns()
returns trigger
language plpgsql
as $$
declare
  v_jwt_role text := 'authenticated';
begin
  -- SEC-8 (preserved): WHO the match is between is pinned forever.
  if new.user_a_id is distinct from old.user_a_id
     or new.user_b_id is distinct from old.user_b_id then
    raise exception 'match participants are immutable' using errcode = 'PD012';
  end if;

  -- Defensive: a missing or malformed jwt claim context must not raise here.
  begin
    v_jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      'authenticated'
    );
  exception when others then
    v_jwt_role := 'authenticated';
  end;

  -- WS-MSG-06: proposal_sent is the free-text gate.
  if new.proposal_sent is distinct from old.proposal_sent then
    -- The gate never re-locks.
    if old.proposal_sent and not new.proposal_sent then
      raise exception 'matches.proposal_sent cannot be cleared once the gate is open'
        using errcode = 'PD013';
    end if;
    -- Opening it requires that a proposal has actually been sent for this match.
    if v_jwt_role <> 'service_role'
       and not exists (select 1 from public.proposals p where p.match_id = new.id)
       and not exists (
         select 1 from public.messages msg
          where msg.match_id = new.id and msg.content_type = 'proposal_card'
       ) then
      raise exception 'matches.proposal_sent can only open after a proposal is sent'
        using errcode = 'PD013';
    end if;
  end if;

  -- WS-MSG-06: 'blocked' is terminal for a participant.
  if old.status = 'blocked'
     and new.status is distinct from old.status
     and v_jwt_role <> 'service_role' then
    raise exception 'a blocked match cannot be revived by a participant'
      using errcode = 'PD013';
  end if;

  return new;
end;
$$;

comment on function public.enforce_match_immutable_columns() is
  'WS-MSG-06 (extends SEC-8): pins participants, refuses a proposal_sent flip that is not backed by a real proposal (the free-text unlock exploit), and keeps a blocked match terminal for participants. SQLSTATE PD012 (participants), PD013 (gate/status).';

-- Replace the SEC-8 participant-only trigger with the extended column trigger.
drop trigger if exists matches_enforce_immutable_participants on public.matches;
drop trigger if exists matches_enforce_immutable_columns on public.matches;
create trigger matches_enforce_immutable_columns
  before update on public.matches
  for each row execute procedure public.enforce_match_immutable_columns();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.enforce_match_immutable_columns() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.enforce_match_immutable_columns() from authenticated';
  end if;
  execute 'revoke all on function public.enforce_match_immutable_columns() from public';
end;
$$;
