-- ============================================================
-- L-1 — PROPOSAL AUTHORIZATION (RLS, not just app-layer)
--
-- `respondToProposal()` in lib/supabase/deals.ts refused self-accept in
-- TypeScript only. The proposals UPDATE policy was
--     using (is_match_participant(match_id))
--     with check (is_match_participant(match_id))
-- which let a proposal's own sender accept their own proposal straight
-- through PostgREST, bypassing the app check entirely.
--
-- PRODUCT DECISION: ANY match participant may CREATE a proposal (not brands
-- only — the previous comment on proposals_insert was wrong and disagreed
-- with the policy body, which never checked role). The response rule is
-- therefore:
--     the responder must be a match participant AND must not be the sender.
-- The sender retains exactly one write: withdrawing their own pending
-- proposal.
-- ============================================================

-- ------------------------------------------------------------
-- INSERT — unchanged behaviour, corrected documentation.
-- ------------------------------------------------------------
drop policy if exists "proposals_insert" on public.proposals;

-- Any participant in the match may open a proposal, and only as themselves.
create policy "proposals_insert"
  on public.proposals for insert
  with check (
    sender_id = auth.uid()
    and public.is_match_participant(match_id)
  );

-- ------------------------------------------------------------
-- UPDATE — split the two legitimate write paths.
--
--   Responder path : participant, NOT the sender. May move the proposal to
--                    accepted / declined / countered.
--   Sender path    : the sender may only take their OWN proposal from
--                    pending to withdrawn.
--
-- USING sees the row as it currently is; WITH CHECK sees the row as it will
-- be. sender_id is immutable in practice (no path rewrites it), so testing it
-- in both halves is safe.
-- ------------------------------------------------------------
drop policy if exists "proposals_update" on public.proposals;

create policy "proposals_update"
  on public.proposals for update
  using (
    public.is_match_participant(match_id)
    and (
      -- responder: anyone in the match except the sender
      sender_id <> auth.uid()
      -- sender: only while their proposal is still pending
      or status = 'pending'
    )
  )
  with check (
    public.is_match_participant(match_id)
    and (
      sender_id <> auth.uid()
      -- the only status a sender may write onto their own proposal
      or status = 'withdrawn'
    )
  );

comment on table public.proposals is
  'Deal proposals. ANY match participant may create one (L-1 product decision). Only a participant who is NOT the sender may accept/decline/counter; the sender may only withdraw their own pending proposal. State transitions that also touch other tables go through public.accept_proposal() / public.counter_proposal().';
