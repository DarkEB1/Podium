import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B-1 — match-creation trigger (+ DI-3 archive semantics).
// No live Postgres in the Vitest suite, so — following the convention of the
// other migration tests in this directory — we assert the structural contract
// of the SQL text.

const sql = readFileSync(
  join(__dirname, '20260720001000_match_creation_trigger.sql'),
  'utf8',
)
const normalised = sql.toLowerCase()

describe('B-1 match_creation_trigger migration', () => {
  it('defines the trigger function as SECURITY DEFINER with a pinned search_path', () => {
    expect(normalised).toMatch(
      /create or replace function public\.create_match_on_connection_accepted\(\)[\s\S]*?security definer set search_path = public/,
    )
  })

  it('fires AFTER INSERT and AFTER UPDATE on connection_requests', () => {
    expect(normalised).toMatch(
      /create trigger connection_requests_create_match\s+after insert or update on public\.connection_requests/,
    )
  })

  it('only acts on the transition into accepted', () => {
    expect(normalised).toContain("if new.status <> 'accepted' then")
    expect(normalised).toContain("if old.status is not distinct from 'accepted' then")
  })

  it('never reads OLD on INSERT (guards the OLD access behind tg_op)', () => {
    // PL/pgSQL raises "record old is not assigned yet" if OLD is read in an
    // INSERT trigger, and does not guarantee short-circuit boolean evaluation.
    expect(normalised).toMatch(/if tg_op = 'update' then[\s\S]*?old\.status/)
  })

  it('canonicalises the pair as (least, greatest) so the match is symmetric', () => {
    expect(normalised).toContain('least(new.sender_id, new.recipient_id)')
    expect(normalised).toContain('greatest(new.sender_id, new.recipient_id)')
  })

  it('enforces canonical ordering with a check constraint', () => {
    expect(normalised).toMatch(
      /add constraint matches_canonical_pair\s+check \(user_a_id < user_b_id\)/,
    )
  })

  it('is idempotent on re-acceptance via ON CONFLICT DO NOTHING', () => {
    expect(normalised).toContain('on conflict (user_a_id, user_b_id) do nothing')
  })

  it('sets connection_request_id, active status and the proposal gate columns', () => {
    for (const col of [
      'connection_request_id',
      'status',
      'proposal_required',
      'proposal_sent',
      'matched_at',
    ]) {
      expect(normalised, `missing ${col} in the match insert`).toContain(col)
    }
    expect(normalised).toMatch(/'active',\s*\n\s*true,\s*--[^\n]*\n\s*false,/)
  })

  it('backfills matches for already-accepted connection requests', () => {
    expect(normalised).toMatch(
      /from public\.connection_requests cr\s*\n\s*where cr\.status = 'accepted'/,
    )
  })

  it('never hard-deletes anything (DI-3)', () => {
    expect(normalised).not.toMatch(/delete\s+from/)
    expect(normalised).not.toMatch(/drop\s+table/)
  })

  it('documents reversible archiving on matches.status (DI-3)', () => {
    expect(normalised).toMatch(/comment on column public\.matches\.status is/)
    expect(normalised).toContain('archiving is reversible')
    expect(normalised).toContain('does not reinstate withdrawn proposals')
  })

  it('replaces matches_update with a policy that has a WITH CHECK', () => {
    expect(normalised).toMatch(
      /create policy "matches_update"[\s\S]*?using \([\s\S]*?\)\s*\n\s*with check \(/,
    )
  })
})
