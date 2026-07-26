import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-2 — accept_proposal() assumed the proposal's sender was the brand, so an
// athlete-opened proposal produced a contract with brand_id = the athlete.
// SEC-5 — the contract was inserted without an explicit status, landing in
// 'draft' when the signature flow expects 'pending_brand_signature'.
//
// Regex-over-SQL assertions: they cannot execute the function. Only a live
// database proves the seat resolution is correct end to end.

const sql = readFileSync(
  join(__dirname, '20260720005001_accept_proposal_role_resolution.sql'),
  'utf8'
).toLowerCase()

/** Executable statements only — the header comments quote the defective code. */
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

describe('SEC-2 accept_proposal role resolution migration', () => {
  it('never derives the brand from the proposal sender', () => {
    expect(code).not.toMatch(/v_brand\s*:=\s*v_proposal\.sender_id/)
  })

  it('reads public.users.role for both participants', () => {
    expect(sql).toMatch(/select u\.role into v_role_a[\s\S]*v_match\.user_a_id/)
    expect(sql).toMatch(/select u\.role into v_role_b[\s\S]*v_match\.user_b_id/)
  })

  it('raises rather than writing an inverted or ambiguous contract', () => {
    expect(sql).toContain("errcode = 'pd008'") // neither participant is a brand
    expect(sql).toContain("errcode = 'pd009'") // both are brands
    expect(sql).toContain("errcode = 'pd010'") // counterparty is not athlete/team
  })

  it('resolves the seats before any write so a refusal leaves the proposal pending', () => {
    expect(sql.indexOf("errcode = 'pd008'")).toBeLessThan(
      sql.indexOf("set status = 'accepted'")
    )
  })

  it('sets the contract status explicitly to pending_brand_signature', () => {
    expect(sql).toContain("'pending_brand_signature'")
  })
})
