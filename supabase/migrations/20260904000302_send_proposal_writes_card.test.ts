import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-MSG-04 — send_proposal must also write the proposal_card timeline message,
// or the recipient opens the thread to "No messages yet". Static assertions on
// the migration SQL (the suite does not run against a live Postgres).

const sql = readFileSync(
  join(__dirname, '20260904000302_send_proposal_writes_card.sql'),
  'utf8',
).toLowerCase()

describe('WS-MSG-04 send_proposal writes a proposal_card', () => {
  it('redefines send_proposal as the same security-definer function', () => {
    expect(sql).toContain('create or replace function public.send_proposal(')
    expect(sql).toMatch(/security definer set search_path = public/)
  })

  it('inserts a proposal_card message carrying the new proposal id', () => {
    expect(sql).toContain('insert into public.messages')
    expect(sql).toContain("'proposal_card'")
    expect(sql).toContain("jsonb_build_object('proposal_id', v_proposal.id)")
  })

  it('still inserts the proposal and opens the gate in the same transaction', () => {
    expect(sql).toContain('insert into public.proposals')
    expect(sql).toMatch(/update public\.matches\s+set proposal_sent = true/)
  })

  it('keeps sender_id sourced from auth.uid()', () => {
    expect(sql).toMatch(/v_caller\s+uuid := auth\.uid\(\)/)
    expect(sql).not.toMatch(/p_sender_id/)
  })

  it('keeps the participant/auth authorization and the row lock', () => {
    expect(sql).toContain("errcode = 'pd001'")
    expect(sql).toContain("errcode = 'pd005'")
    expect(sql).toContain("errcode = 'pd006'")
    expect(sql).toMatch(/from public\.matches\s+where id = p_match_id\s+for update/)
  })
})
