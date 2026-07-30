-- ============================================================
-- QA-1.4 — SENDING A PROPOSAL UNLOCKS FREE-TEXT MESSAGING
--
-- matches carries a two-column gate: proposal_required, plus proposal_sent as
-- the release. Both the RLS policy on messages (20260419000004) and sendMessage
-- (lib/supabase/messaging.ts) refuse a free-text message until proposal_sent is
-- true, and only ever set it as a side effect of a message whose content_type is
-- 'proposal_card'.
--
-- Nothing in the product ever sent such a message. Brands create proposals
-- through POST /api/deals/proposals -> sendProposal(), which inserted a
-- proposals row and touched nothing else, so proposal_sent stayed false for the
-- lifetime of every match and free-text chat never opened for any pairing. The
-- gate's own comment in 20260720005005 documents the intended wiring that was
-- never built.
--
-- Fixed here rather than in the route because the two writes must not be able to
-- come apart: a stored proposal with the gate still shut leaves a match that can
-- never chat, and a retry would insert a duplicate proposal. Same reasoning, and
-- the same shape, as accept_proposal/counter_proposal in 20260720001003.
--
-- SECURITY DEFINER bypasses RLS, so this repeats the proposals_insert policy's
-- authorization itself: the caller must be authenticated and a participant in
-- the match, and sender_id comes from auth.uid() rather than from the client.
--
-- Reuses the existing SQLSTATEs:
--   PD001 not authenticated   PD005 caller is not a match participant
--   PD006 match not found
-- ============================================================

create or replace function public.send_proposal(
  p_match_id         uuid,
  p_title            text,
  p_pay_amount       numeric,
  p_pay_type         public.pay_type,
  p_deliverables     jsonb   default '{}'::jsonb,
  p_pay_currency     text    default 'GBP',
  p_timeline_start   date    default null,
  p_timeline_end     date    default null,
  p_usage_rights     jsonb   default null,
  p_additional_terms text    default null
)
returns public.proposals
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_match    public.matches;
  v_proposal public.proposals;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = 'PD001';
  end if;

  -- FOR UPDATE: serialises two proposals racing to flip the same gate.
  select * into v_match
    from public.matches
   where id = p_match_id
     for update;

  if not found then
    raise exception 'Match not found' using errcode = 'PD006';
  end if;

  if v_match.user_a_id <> v_caller and v_match.user_b_id <> v_caller then
    raise exception 'Not a participant in this match' using errcode = 'PD005';
  end if;

  insert into public.proposals (
    match_id,
    sender_id,
    title,
    deliverables,
    pay_amount,
    pay_currency,
    pay_type,
    timeline_start,
    timeline_end,
    usage_rights,
    additional_terms
  )
  values (
    p_match_id,
    v_caller,
    p_title,
    coalesce(p_deliverables, '{}'::jsonb),
    p_pay_amount,
    coalesce(p_pay_currency, 'GBP'),
    p_pay_type,
    p_timeline_start,
    p_timeline_end,
    p_usage_rights,
    p_additional_terms
  )
  returning * into v_proposal;

  -- The release the gate was always waiting for. Guarded so an already-open
  -- match is not written again on every subsequent proposal.
  if not v_match.proposal_sent then
    update public.matches
       set proposal_sent = true
     where id = p_match_id;
  end if;

  return v_proposal;
end;
$$;

comment on function public.send_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) is
  'QA-1.4: inserts a proposal and opens the match''s free-text gate (matches.proposal_sent) in one transaction. sender_id is auth.uid(); the caller must be a match participant.';

revoke all on function public.send_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) from public;
grant execute on function public.send_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) to authenticated, service_role;
