import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-MSG-06 — any participant could PATCH matches.proposal_sent = true and
// unlock free-text chat without a proposal ever being sent. The match-integrity
// trigger is extended to cover proposal_sent and status. Static SQL assertions.

const sql = readFileSync(
  join(__dirname, '20260904000202_match_column_immutability.sql'),
  'utf8',
).toLowerCase()

describe('WS-MSG-06 match column immutability migration', () => {
  it('keeps the SEC-8 participant pin', () => {
    expect(sql).toContain('new.user_a_id is distinct from old.user_a_id')
    expect(sql).toContain('new.user_b_id is distinct from old.user_b_id')
    expect(sql).toContain('match participants are immutable')
  })

  it('rejects re-closing the gate (true -> false)', () => {
    expect(sql).toContain('old.proposal_sent and not new.proposal_sent')
    expect(sql).toContain('cannot be cleared once the gate is open')
  })

  it('only opens proposal_sent when a real proposal exists for the match', () => {
    expect(sql).toContain('new.proposal_sent is distinct from old.proposal_sent')
    expect(sql).toContain('select 1 from public.proposals p where p.match_id = new.id')
    expect(sql).toContain("where msg.match_id = new.id and msg.content_type = 'proposal_card'")
    expect(sql).toContain('can only open after a proposal is sent')
  })

  it('keeps a blocked match terminal for participants but not the service role', () => {
    expect(sql).toContain("old.status = 'blocked'")
    expect(sql).toContain('new.status is distinct from old.status')
    expect(sql).toContain('a blocked match cannot be revived by a participant')
    expect(sql).toContain("v_jwt_role <> 'service_role'")
  })

  it('reads the JWT role defensively and exempts the service role', () => {
    expect(sql).toContain("nullif(current_setting('request.jwt.claims', true), '')")
    expect(sql).toContain('exception when others then')
  })

  it('replaces the SEC-8 participant trigger with the extended column trigger', () => {
    expect(sql).toContain('drop trigger if exists matches_enforce_immutable_participants on public.matches')
    expect(sql).toMatch(
      /create trigger matches_enforce_immutable_columns\s*\n\s*before update on public\.matches/,
    )
    expect(sql).toContain('execute procedure public.enforce_match_immutable_columns()')
  })
})
