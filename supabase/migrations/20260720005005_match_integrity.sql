-- ============================================================
-- SEC-8 — MATCH INTEGRITY: PINNED PARTICIPANTS, REVIVABLE MATCHES,
--         VALIDATED CANONICAL-PAIR CONSTRAINT
--
-- Supersedes parts of 20260720001000_match_creation_trigger.sql (untouched).
--
-- DEFECT D (security) — a participant could manufacture a match with a stranger.
--   20260720001000:157-160 wrote
--     using      (user_a_id = auth.uid() or user_b_id = auth.uid())
--     with check (user_a_id = auth.uid() or user_b_id = auth.uid())
--   WITH CHECK only asks "is the caller still one side AFTER the update". So
--       patch /matches?id=eq.<mine>  {"user_b_id": "<victim uuid>"}
--   passes: the attacker is still user_a. The victim never accepted a
--   connection request, yet now shares a match — which is the gate for
--   messaging (messages RLS keys off is_match_participant) and for proposals.
--   matches_canonical_pair only requires user_a_id < user_b_id, which an
--   attacker satisfies by choosing which slot to overwrite.
--   FIX: pin BOTH participant columns with a BEFORE UPDATE trigger. A trigger
--   also covers the service-role/admin client, which bypasses RLS entirely, and
--   cannot be worked around by playing USING off against WITH CHECK. Only the
--   creation paths (the connection-accepted trigger and the backfill INSERT)
--   ever set participants, and INSERTs are unaffected.
--   Participants keep the ability to write status (archive/unarchive, DI-3) and
--   proposal_sent (flipped by sendMessage in lib/supabase/messaging.ts:192).
--
-- DEFECT G (correctness) — re-acceptance never revived an archived match.
--   20260720001000:91 used `on conflict (user_a_id, user_b_id) do nothing`, so
--   a pair who matched, archived (or blocked) and then went through a FRESH
--   connection request got no match at all: the row stayed archived and
--   get_conversations filters on status, so the new connection silently
--   vanished. Archiving is documented as REVERSIBLE (20260720001000:140-143),
--   so acceptance now revives the row — except from 'blocked', which is
--   terminal and must never be auto-cleared by someone re-sending a request.
--
-- DEFECT J (would-fail-later) — NOT VALID constraints ARE enforced on UPDATE.
--   20260720001000:24-33 skipped legacy non-canonical rows whose mirror already
--   existed, then added matches_canonical_pair NOT VALID. NOT VALID only
--   suppresses the scan of EXISTING rows; every future INSERT **and UPDATE** is
--   still checked. Any surviving (a > b) row therefore throws 23514 on its next
--   update — including sendMessage's proposal_sent flip, which would break
--   messaging for that pair permanently. FIX: merge the duplicate mirrors into
--   the canonical row, then re-add the constraint VALIDATED.
-- ============================================================

-- ------------------------------------------------------------
-- 1. (Defect J) Merge legacy non-canonical duplicates into their canonical
--    mirror, then validate the constraint.
--
--    Dependants are re-pointed rather than cascaded: contracts.match_id has no
--    ON DELETE clause, and deleting a match would cascade its messages and
--    proposals away. message_reads is a watermark only — the losing row is
--    dropped rather than merged, so at worst a conversation shows as unread
--    once.
--
--    The proposals re-point has to step around the SEC-1 immutability trigger
--    (20260720005000), which pins proposals.match_id. This is the one
--    legitimate exception: the match id is not changing WHO the proposal is
--    between, it is repairing a duplicate row for the same pair.
-- ------------------------------------------------------------
do $$
declare
  v_dupe record;
  v_moved integer := 0;
begin
  alter table public.proposals disable trigger proposals_enforce_immutable_columns;

  for v_dupe in
    select m.id as dupe_id, o.id as keep_id
      from public.matches m
      join public.matches o
        on o.user_a_id = m.user_b_id
       and o.user_b_id = m.user_a_id
     where m.user_a_id > m.user_b_id
  loop
    update public.messages    set match_id = v_dupe.keep_id where match_id = v_dupe.dupe_id;
    update public.proposals   set match_id = v_dupe.keep_id where match_id = v_dupe.dupe_id;
    update public.contracts   set match_id = v_dupe.keep_id where match_id = v_dupe.dupe_id;
    delete from public.message_reads where match_id = v_dupe.dupe_id;
    delete from public.matches      where id       = v_dupe.dupe_id;
    v_moved := v_moved + 1;
  end loop;

  -- Any remaining non-canonical row now has no mirror, so it can simply be
  -- swapped into canonical order.
  update public.matches m
     set user_a_id = m.user_b_id,
         user_b_id = m.user_a_id
   where m.user_a_id > m.user_b_id;

  alter table public.proposals enable trigger proposals_enforce_immutable_columns;

  raise notice 'SEC-8: merged % duplicate mirror match rows.', v_moved;
exception
  when others then
    -- Never leave the immutability trigger disabled.
    begin
      alter table public.proposals enable trigger proposals_enforce_immutable_columns;
    exception when others then null;
    end;
    raise;
end;
$$;

alter table public.matches
  drop constraint if exists matches_canonical_pair;

do $$
begin
  alter table public.matches
    add constraint matches_canonical_pair check (user_a_id < user_b_id);
exception
  when check_violation then
    -- Should be unreachable after step 1; re-add NOT VALID and shout rather
    -- than abort the migration, so the operator can inspect the rows.
    execute 'alter table public.matches
               add constraint matches_canonical_pair
               check (user_a_id < user_b_id) not valid';
    raise warning 'SEC-8: non-canonical matches rows remain; matches_canonical_pair re-added NOT VALID. Those rows will still fail on UPDATE — investigate.';
end;
$$;

comment on constraint matches_canonical_pair on public.matches is
  'Matches are symmetric: the pair is always stored as (least, greatest) so matches_unique_pair dedupes A-B and B-A. VALIDATED (SEC-8) — the earlier NOT VALID version still threw 23514 on every UPDATE of a legacy non-canonical row.';

-- ------------------------------------------------------------
-- 2. (Defect G) Acceptance revives an archived match.
-- ------------------------------------------------------------
create or replace function public.create_match_on_connection_accepted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> 'accepted' then
    return null;
  end if;

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
    true,
    false,
    now()
  )
  on conflict (user_a_id, user_b_id) do update
     set status                = 'active',
         connection_request_id = excluded.connection_request_id,
         matched_at            = excluded.matched_at
   -- 'blocked' is terminal: re-sending a connection request must never
   -- silently undo a block.
   where matches.status <> 'blocked';

  return null;
end;
$$;

comment on function public.create_match_on_connection_accepted() is
  'B-1/SEC-8: creates the symmetric public.matches row when a connection_request becomes accepted, and REVIVES an archived one (DI-3 says archiving is reversible). A blocked match is never revived.';

-- ------------------------------------------------------------
-- 3. (Defect D) Participants are immutable after creation.
-- ------------------------------------------------------------
create or replace function public.enforce_match_immutable_participants()
returns trigger
language plpgsql
as $$
begin
  if new.user_a_id is distinct from old.user_a_id
     or new.user_b_id is distinct from old.user_b_id then
    raise exception 'match participants are immutable' using errcode = 'PD012';
  end if;
  return new;
end;
$$;

comment on function public.enforce_match_immutable_participants() is
  'SEC-8: pins matches.user_a_id / user_b_id. The matches_update WITH CHECK only asked whether the caller was STILL a participant after the write, which let a participant swap the other side for an arbitrary victim and manufacture a messaging + proposal channel. Raises SQLSTATE PD012.';

drop trigger if exists matches_enforce_immutable_participants on public.matches;
create trigger matches_enforce_immutable_participants
  before update on public.matches
  for each row execute procedure public.enforce_match_immutable_participants();

-- The policy itself is unchanged in shape but re-declared with `to
-- authenticated` and a comment pointing at the trigger that does the real work.
drop policy if exists "matches_update" on public.matches;

create policy "matches_update"
  on public.matches for update
  to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid())
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

comment on policy "matches_update" on public.matches is
  'Participants may archive/unarchive (DI-3) and flip proposal_sent. WHO the match is between is pinned by trigger matches_enforce_immutable_participants (SEC-8) — a WITH CHECK alone cannot express immutability because it only sees the post-update row.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.enforce_match_immutable_participants() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.enforce_match_immutable_participants() from authenticated';
  end if;
  execute 'revoke all on function public.enforce_match_immutable_participants() from public';
  execute 'revoke all on function public.create_match_on_connection_accepted() from public';
end;
$$;
