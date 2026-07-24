-- ============================================================
-- SEC-2 — accept_proposal() MUST RESOLVE THE BRAND SEAT FROM ROLES,
--         NOT FROM WHO HAPPENED TO SEND THE PROPOSAL
--
-- Supersedes the body of public.accept_proposal() as written in
-- 20260720001003_deal_transactions.sql (that file is left untouched).
--
-- DEFECT: 20260720001003:92-98 did
--     v_brand := v_proposal.sender_id;   -- "the sender is the paying side"
-- but the product decision recorded in 20260720001002 is that ANY match
-- participant may open a proposal, and proposals_insert enforces nothing about
-- role. So whenever an ATHLETE or TEAM opened the proposal, the contract was
-- written inverted:
--     contracts.brand_id            = the athlete/team
--     contracts.athlete_or_team_id  = the brand
-- That inversion is not cosmetic. contracts_select (20260419000005:108) keys
-- off both columns, and payments treat brand_id as the payer and
-- athlete_or_team_id as the payee — an inverted row points the money the wrong
-- way and mislabels every downstream record.
--
-- FIX: read public.users.role for BOTH match participants and assign the seats
-- from the roles. The function is SECURITY DEFINER, so it can read users rows
-- that users_select_own would otherwise hide from the caller.
--
-- AMBIGUOUS / IMPOSSIBLE PAIRINGS — we raise rather than guess, because a
-- wrong row here is a wrong contract and a wrong payment direction:
--   PD008  neither participant has role 'brand' (includes not-yet-set roles).
--   PD009  BOTH participants have role 'brand' — there is no payee seat.
--   PD010  the non-brand participant is neither 'athlete' nor 'team'.
--          Agent-represented deals are the known case: contracts.agent_id
--          exists but athlete_or_team_id is NOT NULL, and an agent may hold
--          many representation_links, so the represented client cannot be
--          derived from the match alone. Rather than invent a join we refuse
--          the acceptance and surface a clear error; supporting brand<->agent
--          matches needs a product decision plus a schema change.
-- Team<->brand deals are fully supported: 'team' is a valid athlete_or_team_id
-- seat, which is exactly why the column is named athlete_or_team_id.
--
-- Existing SQLSTATEs from 20260720001003 are unchanged:
--   PD001 not authenticated   PD002 not found   PD003 not pending
--   PD004 caller is sender    PD005 not a participant   PD006 match not found
-- (PD007 is the proposals immutability trigger, 20260720005000.)
-- ============================================================

create or replace function public.accept_proposal(p_proposal_id uuid)
returns public.proposals
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller       uuid := auth.uid();
  v_proposal     public.proposals;
  v_match        public.matches;
  v_role_a       public.user_role;
  v_role_b       public.user_role;
  v_brand        uuid;
  v_counterparty uuid;
  v_counter_role public.user_role;
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

  -- ----------------------------------------------------------
  -- Seat resolution BEFORE any write, so an unresolvable pairing aborts the
  -- transaction with the proposal still pending rather than leaving it
  -- accepted-with-no-contract.
  -- ----------------------------------------------------------
  select u.role into v_role_a from public.users u where u.id = v_match.user_a_id;
  select u.role into v_role_b from public.users u where u.id = v_match.user_b_id;

  if v_role_a = 'brand' and v_role_b = 'brand' then
    raise exception 'Both match participants are brands; no athlete or team seat for this contract'
      using errcode = 'PD009';
  elsif v_role_a = 'brand' then
    v_brand        := v_match.user_a_id;
    v_counterparty := v_match.user_b_id;
    v_counter_role := v_role_b;
  elsif v_role_b = 'brand' then
    v_brand        := v_match.user_b_id;
    v_counterparty := v_match.user_a_id;
    v_counter_role := v_role_a;
  else
    raise exception 'Neither match participant has the brand role; cannot determine the paying side'
      using errcode = 'PD008';
  end if;

  if v_counter_role is distinct from 'athlete' and v_counter_role is distinct from 'team' then
    raise exception 'Counterparty is not an athlete or team; agent-represented deals are not supported by accept_proposal()'
      using errcode = 'PD010';
  end if;

  update public.proposals
     set status = 'accepted',
         responded_at = now()
   where id = p_proposal_id
  returning * into v_proposal;

  -- SEC-5: status is set EXPLICITLY. contracts.status defaults to 'draft'
  -- (20260419000005:64), but the signature flow — and supabase/seed.sql:294,
  -- which models a freshly accepted deal — expect 'pending_brand_signature'.
  -- Omitting it left every accepted deal in a state the UI cannot sign.
  insert into public.contracts (
    proposal_id,
    match_id,
    brand_id,
    athlete_or_team_id,
    status,
    terms_snapshot
  )
  values (
    v_proposal.id,
    v_proposal.match_id,
    v_brand,
    v_counterparty,
    'pending_brand_signature',
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
  'SB-8/DI-2 + SEC-2: accepts a proposal and creates its contract in one transaction, snapshotting the economic terms. Caller must be a match participant and must not be the proposal sender. contracts.brand_id / athlete_or_team_id are resolved from public.users.role, NOT from who sent the proposal (an athlete-opened proposal used to produce an inverted contract). Raises PD008 when no participant is a brand, PD009 when both are, PD010 when the non-brand participant is not an athlete or team.';

revoke all on function public.accept_proposal(uuid) from public;
grant execute on function public.accept_proposal(uuid) to authenticated, service_role;
