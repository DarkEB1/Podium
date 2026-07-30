import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// QA-1.4 — sending a proposal must open the match's free-text gate. Static
// assertions on the migration SQL (the suite does not run against a live
// Postgres).

const sql = readFileSync(
  join(__dirname, '20260730000200_send_proposal_unlocks_messaging.sql'),
  'utf8',
).toLowerCase()

describe('QA-1.4 send_proposal migration', () => {
  it('defines send_proposal re-runnably as a security-definer function', () => {
    expect(sql).toContain('create or replace function public.send_proposal(')
    expect(sql).toMatch(/security definer set search_path = public/)
  })

  it('inserts the proposal and flips proposal_sent in the same function', () => {
    expect(sql).toContain('insert into public.proposals')
    expect(sql).toMatch(/update public\.matches\s+set proposal_sent = true/)
  })

  it('takes sender_id from auth.uid(), never from the caller', () => {
    expect(sql).toMatch(/v_caller\s+uuid := auth\.uid\(\)/)
    expect(sql).not.toMatch(/p_sender_id/)
  })

  it('does its own authorization, since security definer bypasses RLS', () => {
    expect(sql).toContain("raise exception 'authentication required' using errcode = 'pd001'")
    expect(sql).toMatch(/user_a_id <> v_caller and v_match\.user_b_id <> v_caller/)
    expect(sql).toContain("errcode = 'pd005'")
    expect(sql).toContain("errcode = 'pd006'")
  })

  it('locks the match row so two proposals cannot race the gate', () => {
    expect(sql).toMatch(/from public\.matches\s+where id = p_match_id\s+for update/)
  })

  it('skips the gate write when the match is already open', () => {
    expect(sql).toContain('if not v_match.proposal_sent then')
  })

  it('is executable by authenticated callers only', () => {
    expect(sql).toContain('revoke all on function public.send_proposal')
    expect(sql).toMatch(/grant execute on function public\.send_proposal[\s\S]*to authenticated, service_role/)
  })
})
