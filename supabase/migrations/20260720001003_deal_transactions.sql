-- ============================================================
-- SB-8 / DI-2 — ATOMIC ACCEPT -> CONTRACT WITH TERMS SNAPSHOT
-- SB-7        — ATOMIC COUNTER-PROPOSAL
--
-- Both flows were previously two independent round-trips from the app:
--   accept : UPDATE proposals ... then INSERT contracts (admin client)
--   counter: UPDATE parent 'countered' ... then INSERT the counter
-- A crash or a failed second statement left an accepted proposal with no
-- contract, or an orphaned 'countered' parent with no child. Both are now
-- single SECURITY DEFINER functions, so each runs in one transaction.
--
-- The functions do their own authorization (SECURITY DEFINER bypasses RLS),
-- mirroring the proposals_update policy from 20260720001002.
--
-- Custom SQLSTATEs surfaced to the client via PostgREST:
--   PD001 not authenticated       PD004 caller is the proposal's sender
--   PD002 proposal not found      PD005 caller is not a match participant
--   PD003 proposal not pending    PD006 match not found
-- ============================================================

-- ------------------------------------------------------------
-- Contract terms snapshot (DI-2)
--
-- A contract must record the economic terms AS THEY WERE AT ACCEPTANCE.
-- proposals rows remain mutable, so the contract cannot rely on a join.
-- ------------------------------------------------------------
alter table public.contracts
  add column if not exists terms_snapshot jsonb;

comment on column public.contracts.terms_snapshot is
  'DI-2: immutable copy of the accepted proposal''s economic terms (title, deliverables, pay_amount, pay_currency, pay_type, timeline, usage_rights, additional_terms) captured by public.accept_proposal() at the moment of acceptance.';

-- One contract per proposal — makes accept_proposal() safely re-runnable.
create unique index if not exists contracts_proposal_id_key
  on public.contracts (proposal_id);

-- ------------------------------------------------------------
-- accept_proposal(p_proposal_id)
-- ------------------------------------------------------------
create or replace function public.accept_proposal(p_proposal_id uuid)
returns public.proposals
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_proposal public.proposals;
  v_match    public.matches;
  v_brand    uuid;
  v_counterparty uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = 'PD001';
  end if;

  -- FOR UPDATE: serialises concurrent accept/decline/counter on the same row.
  select * into v_proposal
    from public.proposals
   where id = p_proposal_id
     for update;

  if not found then
    raise exception 'Proposal not found' using errcode = 'PD002';
  end if;

  select * into v_match
    from public.matches
   where id = v_proposal.match_id;

  if not found then
    raise exception 'Match not found' using errcode = 'PD006';
  end if;

  if v_match.user_a_id <> v_caller and v_match.user_b_id <> v_caller then
    raise exception 'Not a participant in this match' using errcode = 'PD005';
  end if;

  if v_proposal.sender_id = v_caller then
    raise exception 'Sender cannot respond to their own proposal' using errcode = 'PD004';
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'Proposal is not in pending status' using errcode = 'PD003';
  end if;

  update public.proposals
     set status = 'accepted',
         responded_at = now()
   where id = p_proposal_id
  returning * into v_proposal;

  -- The proposal's sender is the paying side of the deal (the brand seat);
  -- the accepting participant is the athlete/team seat.
  v_brand := v_proposal.sender_id;
  v_counterparty := case
    when v_match.user_a_id = v_brand then v_match.user_b_id
    else v_match.user_a_id
  end;

  insert into public.contracts (
    proposal_id,
    match_id,
    brand_id,
    athlete_or_team_id,
    terms_snapshot
  )
  values (
    v_proposal.id,
    v_proposal.match_id,
    v_brand,
    v_counterparty,
    jsonb_build_object(
      'title',            v_proposal.title,
      'deliverables',     v_proposal.deliverables,
      'pay_amount',       v_proposal.pay_amount,
      'pay_currency',     v_proposal.pay_currency,
      'pay_type',         v_proposal.pay_type::text,
      'timeline_start',   v_proposal.timeline_start,
      'timeline_end',     v_proposal.timeline_end,
      'usage_rights',     v_proposal.usage_rights,
      'additional_terms', v_proposal.additional_terms,
      'snapshot_at',      now()
    )
  )
  on conflict (proposal_id) do nothing;

  return v_proposal;
end;
$$;

comment on function public.accept_proposal(uuid) is
  'SB-8/DI-2: accepts a proposal and creates its contract in one transaction, snapshotting the economic terms. Caller must be a match participant and must not be the proposal sender.';

revoke all on function public.accept_proposal(uuid) from public;
grant execute on function public.accept_proposal(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- counter_proposal(...)
--
-- Marks the parent 'countered' and inserts the counter as one unit.
-- Argument names match the ProposalPayload keys used by lib/supabase/deals.ts.
-- ------------------------------------------------------------
create or replace function public.counter_proposal(
  p_parent_proposal_id uuid,
  p_title              text,
  p_pay_amount         numeric,
  p_pay_type           public.pay_type,
  p_deliverables       jsonb   default '{}'::jsonb,
  p_pay_currency       text    default 'GBP',
  p_timeline_start     date    default null,
  p_timeline_end       date    default null,
  p_usage_rights       jsonb   default null,
  p_additional_terms   text    default null
)
returns public.proposals
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller  uuid := auth.uid();
  v_parent  public.proposals;
  v_match   public.matches;
  v_counter public.proposals;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = 'PD001';
  end if;

  select * into v_parent
    from public.proposals
   where id = p_parent_proposal_id
     for update;

  if not found then
    raise exception 'Proposal not found' using errcode = 'PD002';
  end if;

  select * into v_match
    from public.matches
   where id = v_parent.match_id;

  if not found then
    raise exception 'Match not found' using errcode = 'PD006';
  end if;

  if v_match.user_a_id <> v_caller and v_match.user_b_id <> v_caller then
    raise exception 'Not a participant in this match' using errcode = 'PD005';
  end if;

  if v_parent.sender_id = v_caller then
    raise exception 'Sender cannot counter their own proposal' using errcode = 'PD004';
  end if;

  if v_parent.status <> 'pending' then
    raise exception 'Proposal is not in pending status' using errcode = 'PD003';
  end if;

  update public.proposals
     set status = 'countered',
         responded_at = now()
   where id = p_parent_proposal_id;

  insert into public.proposals (
    match_id,
    sender_id,
    parent_proposal_id,
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
    v_parent.match_id,
    v_caller,
    p_parent_proposal_id,
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
  returning * into v_counter;

  return v_counter;
end;
$$;

comment on function public.counter_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) is
  'SB-7: marks the parent proposal countered and inserts the counter-proposal in one transaction. Caller must be a match participant and must not be the parent''s sender.';

revoke all on function public.counter_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) from public;
grant execute on function public.counter_proposal(uuid, text, numeric, public.pay_type, jsonb, text, date, date, jsonb, text) to authenticated, service_role;
