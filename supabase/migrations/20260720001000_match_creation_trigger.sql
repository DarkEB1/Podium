-- ============================================================
-- B-1 — MATCH CREATION TRIGGER (+ DI-3 archive semantics)
--
-- The schema (20260419000003_discovery.sql) documents that "Matches are
-- created by service role (trigger on connection_request accepted)" but the
-- trigger was never written. Without it, accepting a connection request left
-- no `matches` row, so messaging / proposals / contracts / payments all
-- dead-ended.
--
-- PRODUCT DECISION — a match is SYMMETRIC. The pair is canonicalised as
--   user_a_id = least(sender_id, recipient_id)
--   user_b_id = greatest(sender_id, recipient_id)
-- so the existing `matches_unique_pair unique (user_a_id, user_b_id)`
-- constraint dedupes A→B and B→A to a single match. Re-acceptance is
-- idempotent via ON CONFLICT DO NOTHING.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Canonicalise any pre-existing rows so the unique pair
--    constraint actually dedupes symmetric pairs.
--    Rows whose mirror already exists are left alone (the mirror
--    is the canonical row; swapping would violate uniqueness).
-- ------------------------------------------------------------
update public.matches m
   set user_a_id = m.user_b_id,
       user_b_id = m.user_a_id
 where m.user_a_id > m.user_b_id
   and not exists (
     select 1
       from public.matches o
      where o.user_a_id = m.user_b_id
        and o.user_b_id = m.user_a_id
   );

-- Enforce canonical ordering going forward. NOT VALID so any legacy
-- non-canonical row that could not be swapped above does not block the
-- migration; the constraint is still enforced on every new/updated row.
alter table public.matches
  drop constraint if exists matches_canonical_pair;

alter table public.matches
  add constraint matches_canonical_pair
  check (user_a_id < user_b_id) not valid;

comment on constraint matches_canonical_pair on public.matches is
  'Matches are symmetric: the pair is always stored as (least, greatest) so matches_unique_pair dedupes A-B and B-A.';

-- ------------------------------------------------------------
-- 2. Trigger function — create the match on acceptance.
--    SECURITY DEFINER because public.matches has no client INSERT
--    policy (by design); the trigger is the only writer.
-- ------------------------------------------------------------
create or replace function public.create_match_on_connection_accepted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only act on the pending -> accepted transition.
  if new.status <> 'accepted' then
    return null;
  end if;

  -- OLD is unassigned on INSERT, so it may only be read for UPDATE.
  -- (PL/pgSQL does not guarantee short-circuit boolean evaluation, hence
  -- the nested IF rather than a combined condition.)
  if tg_op = 'UPDATE' then
    if old.status is not distinct from 'accepted' then
      return null;
    end if;
  end if;

  insert into public.matches (
    user_a_id,
    user_b_id,
    connection_request_id,
    status,
    proposal_required,
    proposal_sent,
    matched_at
  )
  values (
    least(new.sender_id, new.recipient_id),
    greatest(new.sender_id, new.recipient_id),
    new.id,
    'active',
    true,   -- a proposal card must be sent before free-text messaging unlocks
    false,
    now()
  )
  on conflict (user_a_id, user_b_id) do nothing;

  return null; -- AFTER trigger: return value is ignored
end;
$$;

comment on function public.create_match_on_connection_accepted() is
  'B-1: creates the symmetric public.matches row when a connection_request becomes accepted. Idempotent.';

drop trigger if exists connection_requests_create_match on public.connection_requests;

create trigger connection_requests_create_match
  after insert or update on public.connection_requests
  for each row execute procedure public.create_match_on_connection_accepted();

-- ------------------------------------------------------------
-- 3. Backfill — every already-accepted request without a match.
--    DISTINCT ON keeps the earliest acceptance per canonical pair.
-- ------------------------------------------------------------
insert into public.matches (
  user_a_id,
  user_b_id,
  connection_request_id,
  status,
  proposal_required,
  proposal_sent,
  matched_at
)
select distinct on (
         least(cr.sender_id, cr.recipient_id),
         greatest(cr.sender_id, cr.recipient_id)
       )
       least(cr.sender_id, cr.recipient_id),
       greatest(cr.sender_id, cr.recipient_id),
       cr.id,
       'active',
       true,
       false,
       coalesce(cr.responded_at, cr.updated_at, cr.sent_at, now())
  from public.connection_requests cr
 where cr.status = 'accepted'
 order by least(cr.sender_id, cr.recipient_id),
          greatest(cr.sender_id, cr.recipient_id),
          coalesce(cr.responded_at, cr.updated_at, cr.sent_at) asc
on conflict (user_a_id, user_b_id) do nothing;

-- ============================================================
-- DI-3 — MATCH ARCHIVE SEMANTICS
--
-- PRODUCT DECISION: archiving is REVERSIBLE. A participant may move a match
-- active -> archived and archived -> active freely. Un-archiving does NOT
-- reinstate previously withdrawn proposals — those must be re-sent. Nothing
-- is ever hard-deleted on archive.
-- ============================================================

comment on column public.matches.status is
  'active | archived | blocked. Archiving is REVERSIBLE: participants may move a match active <-> archived at will and no data is deleted. Un-archiving does NOT reinstate withdrawn proposals — they must be re-sent. ''blocked'' is terminal for the participants and is set via the blocks flow.';

-- The original matches_update policy had no WITH CHECK at all, so the row a
-- participant wrote back was never re-validated (they could drop themselves
-- out of the match). Replace it with a symmetric USING/WITH CHECK pair: the
-- caller must be a participant both before and after the update, and the
-- canonical-pair CHECK constraint prevents re-ordering. Both the
-- active -> archived and archived -> active transitions are permitted (DI-3).
drop policy if exists "matches_update" on public.matches;

create policy "matches_update"
  on public.matches for update
  using (user_a_id = auth.uid() or user_b_id = auth.uid())
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());
