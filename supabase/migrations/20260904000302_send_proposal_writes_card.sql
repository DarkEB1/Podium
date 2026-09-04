-- ============================================================
-- WS-MSG-04 — A PROPOSAL APPEARS IN THE CHAT TIMELINE
--
-- send_proposal() (20260730000200) inserts a `proposals` row and opens the
-- free-text gate, but never wrote the `proposal_card` MESSAGE that the chat
-- renders. The clients are forbidden from creating one (SEC-3), and nothing else
-- writes it, so the recipient opened the thread after a proposal and saw the
-- "No messages yet" empty state; the proposal was only reachable from the deals
-- surface. ChatWindow renders a proposal card for a message whose
-- metadata.proposal_id resolves, so the fix is to have send_proposal write that
-- message in the same transaction as the proposal.
--
-- Redefines send_proposal identically to 20260730000200 and adds a single
-- INSERT of a `proposal_card` message carrying the new proposal's id. Still
-- SECURITY DEFINER, so it bypasses the messages_insert RLS the same way it
-- bypasses proposals_insert; the card and the proposal cannot come apart because
-- they share the function's transaction. The gate flip stays guarded so a match
-- that is already open is not rewritten.
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

  -- WS-MSG-04: the timeline card the chat renders for this proposal. Same
  -- transaction as the proposal, so a stored proposal always has its card.
  -- metadata.proposal_id is what ChatWindow resolves to render ProposalCardMessage.
  insert into public.messages (
    match_id,
    sender_id,
    content_type,
    metadata
  )
  values (
    p_match_id,
    v_caller,
    'proposal_card',
    jsonb_build_object('proposal_id', v_proposal.id)
  );

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
  'QA-1.4 + WS-MSG-04: inserts a proposal, writes the proposal_card timeline message, and opens the match''s free-text gate (matches.proposal_sent) in one transaction. sender_id is auth.uid(); the caller must be a match participant.';

revoke all on function public.send_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) from public;
grant execute on function public.send_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) to authenticated, service_role;
