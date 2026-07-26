-- ============================================================
-- SEC-1 — PROPOSAL UPDATE HARDENING
--
-- Supersedes the `proposals_update` policy written in
-- 20260720001002_proposal_authorization.sql (never edit an applied migration;
-- this replaces its policy in place).
--
-- TWO DEFECTS ARE CLOSED HERE.
--
-- DEFECT 1 — the sender could accept their own proposal by rewriting sender_id.
--   The superseded policy read:
--     using      (participant and (sender_id <> auth.uid() or status = 'pending'))
--     with check (participant and (sender_id <> auth.uid() or status = 'withdrawn'))
--   USING is evaluated against the OLD row, WITH CHECK against the NEW row, so
--       update proposals
--          set status = 'accepted', sender_id = '<counterparty-uuid>'
--        where id = ...
--   passed USING (old row: I am the sender, status is pending -> 2nd disjunct)
--   AND passed WITH CHECK (new row: sender_id is no longer me -> 1st disjunct).
--   The superseded migration's own comment said "sender_id is immutable in
--   practice" — an assumption RLS must never make. There are no column-level
--   grants on public.proposals anywhere in this repo, so sender_id is fully
--   client-writable through PostgREST.
--
--   FIX: make immutability EXPLICIT with a BEFORE UPDATE trigger. A trigger
--   cannot be dodged by playing OLD and NEW off against each other the way a
--   policy disjunct can, and it protects the service-role/admin client too
--   (which bypasses RLS entirely). The policy below is ALSO tightened so its
--   USING and WITH CHECK halves agree on one identity.
--
-- DEFECT 2 — a legitimate responder could set status = 'accepted' directly.
--   public.accept_proposal() (20260720001003) exists precisely so that
--   accepting a proposal and creating its contract happen in ONE transaction
--   (SB-8/DI-2). But a plain
--       update proposals set status = 'accepted' where id = ...
--   from any non-sender participant satisfied the old policy and produced an
--   ACCEPTED PROPOSAL WITH NO CONTRACT — silently defeating the whole
--   atomicity fix, and leaving downstream payments with no contract row.
--   Same argument applies to 'countered', which must go through
--   public.counter_proposal() so the parent and the child are written together.
--
--   FIX: the client UPDATE policy below can only ever write 'withdrawn' (by the
--   sender) or 'declined' (by the other participant). 'accepted' and
--   'countered' are unreachable from a client UPDATE.
--
--   WHY THE RPCs STILL WORK: accept_proposal() and counter_proposal() are
--   declared `security definer` (20260720001003:43 and :157). They therefore
--   execute as the function owner — the migration role, which owns
--   public.proposals — and row-level security is not applied to a table's
--   owner unless the table is declared FORCE ROW LEVEL SECURITY. No migration
--   in this repo does that, so the restricted policy below does not block
--   them. Do NOT add `force row level security` to public.proposals without
--   first re-testing both RPCs.
-- ============================================================

-- DEFECT 3 (same audit family) — the ECONOMIC terms were mutable too.
--   Any participant could PATCH pay_amount / deliverables / title on a proposal
--   whose accepted contract's terms_snapshot (DI-2) quotes those very values,
--   silently desynchronising the contract from the offer it records. An offer
--   is immutable by definition: changing the numbers IS a counter-proposal, and
--   public.counter_proposal() already inserts a new row for exactly that. So
--   the economic columns are pinned by the same trigger.
--   `additional_terms` is deliberately left mutable: erase_user_data()
--   (20260720003000:182) nulls it as part of GDPR anonymisation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Immutable columns — enforced by trigger, not by assumption.
--
-- match_id, sender_id, parent_proposal_id and created_at define WHO a proposal
-- is between and WHERE it sits in the counter-offer chain. Every authorization
-- decision in this schema (proposals_update, accept_proposal, counter_proposal,
-- contracts.brand_id / athlete_or_team_id) is derived from them, so none of
-- them may ever change after insert. The economic columns are pinned for the
-- terms_snapshot reason above.
-- ------------------------------------------------------------
create or replace function public.enforce_proposal_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.match_id is distinct from old.match_id then
    raise exception 'proposals.match_id is immutable' using errcode = 'PD007';
  end if;

  if new.sender_id is distinct from old.sender_id then
    raise exception 'proposals.sender_id is immutable' using errcode = 'PD007';
  end if;

  if new.parent_proposal_id is distinct from old.parent_proposal_id then
    raise exception 'proposals.parent_proposal_id is immutable' using errcode = 'PD007';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'proposals.created_at is immutable' using errcode = 'PD007';
  end if;

  -- Economic terms. A contract's terms_snapshot (DI-2) is a copy of these
  -- values; letting them drift afterwards makes the contract a lie. Re-pricing
  -- is done by public.counter_proposal(), which inserts a NEW proposal.
  if new.title            is distinct from old.title
     or new.deliverables  is distinct from old.deliverables
     or new.pay_amount    is distinct from old.pay_amount
     or new.pay_currency  is distinct from old.pay_currency
     or new.pay_type      is distinct from old.pay_type
     or new.timeline_start is distinct from old.timeline_start
     or new.timeline_end   is distinct from old.timeline_end
     or new.usage_rights   is distinct from old.usage_rights then
    raise exception 'proposal terms are immutable; send a counter-proposal instead'
      using errcode = 'PD007';
  end if;

  return new;
end;
$$;

comment on function public.enforce_proposal_immutable_columns() is
  'SEC-1: pins proposals.match_id / sender_id / parent_proposal_id / created_at and every economic term (title, deliverables, pay_amount, pay_currency, pay_type, timeline_*, usage_rights) after insert; additional_terms stays mutable for GDPR anonymisation. The superseded proposals_update policy (20260720001002) merely ASSUMED sender_id was immutable, which let a sender accept their own proposal by rewriting sender_id in the same UPDATE. Raises SQLSTATE PD007.';

-- Named so it sorts BEFORE set_proposals_updated_at: Postgres fires same-event
-- BEFORE triggers in name order, and this one must veto first.
drop trigger if exists proposals_enforce_immutable_columns on public.proposals;
create trigger proposals_enforce_immutable_columns
  before update on public.proposals
  for each row execute procedure public.enforce_proposal_immutable_columns();

-- ------------------------------------------------------------
-- 2. UPDATE policy — one identity, two terminal statuses, no 'accepted'.
--
--   Sender    : pending -> withdrawn.
--   Responder : pending -> declined.
--   accepted  : ONLY via public.accept_proposal()  (creates the contract too).
--   countered : ONLY via public.counter_proposal() (writes parent + child).
--
-- USING inspects the row as it is now; WITH CHECK inspects the row as it will
-- be. Because sender_id and match_id are now trigger-pinned, both halves are
-- guaranteed to be talking about the same two people.
-- ------------------------------------------------------------
drop policy if exists "proposals_update" on public.proposals;

create policy "proposals_update"
  on public.proposals for update
  to authenticated
  using (
    public.is_match_participant(match_id)
    -- a settled proposal is final: no client may reopen or rewrite it
    and status = 'pending'
  )
  with check (
    public.is_match_participant(match_id)
    and (
      -- sender's only write: withdraw their own still-pending proposal
      (sender_id = auth.uid() and status = 'withdrawn')
      -- responder's only direct write: decline (it touches no other table)
      or (sender_id <> auth.uid() and status = 'declined')
    )
  );

comment on table public.proposals is
  'Deal proposals. ANY match participant may create one (L-1 product decision). Client UPDATEs may only withdraw (sender) or decline (other participant) a pending proposal: status ''accepted'' is reachable only through public.accept_proposal() and ''countered'' only through public.counter_proposal(), so a proposal can never be accepted without its contract (SB-8/DI-2). match_id, sender_id, parent_proposal_id and created_at are pinned by trigger proposals_enforce_immutable_columns (SEC-1).';
