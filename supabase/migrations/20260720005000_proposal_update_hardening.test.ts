import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-1 — the superseded proposals_update policy let a sender accept their own
// proposal by rewriting sender_id in the same UPDATE, and let any responder set
// status = 'accepted' directly, bypassing accept_proposal() and producing an
// accepted proposal with no contract.
//
// CONVENTION CAVEAT: these are regex assertions over SQL TEXT. They prove the
// migration says what we intend it to say; they CANNOT prove it executes, and
// they cannot prove the resulting policy actually denies the attack. Only a
// live database can do that.

const sql = readFileSync(
  join(__dirname, '20260720005000_proposal_update_hardening.sql'),
  'utf8'
).toLowerCase()

describe('SEC-1 proposal update hardening migration', () => {
  it('pins the identity columns with a BEFORE UPDATE trigger', () => {
    expect(sql).toContain('create or replace function public.enforce_proposal_immutable_columns()')
    expect(sql).toMatch(/before update on public\.proposals/)
    for (const col of ['match_id', 'sender_id', 'parent_proposal_id', 'created_at']) {
      expect(sql, `${col} not pinned`).toMatch(
        new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`)
      )
    }
  })

  it('pins the economic terms but leaves additional_terms mutable for GDPR', () => {
    for (const col of ['title', 'deliverables', 'pay_amount', 'pay_currency', 'pay_type']) {
      expect(sql, `${col} not pinned`).toMatch(
        new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`)
      )
    }
    expect(sql).not.toMatch(/new\.additional_terms\s+is distinct from old\.additional_terms/)
  })

  it('raises PD007 rather than silently ignoring the change', () => {
    expect(sql).toContain("errcode = 'pd007'")
  })

  it('makes accepted and countered unreachable from a client UPDATE', () => {
    const policy = sql.slice(sql.indexOf('create policy "proposals_update"'))
    expect(policy).toContain("status = 'withdrawn'")
    expect(policy).toContain("status = 'declined'")
    expect(policy).not.toContain("status = 'accepted'")
    expect(policy).not.toContain("status = 'countered'")
  })

  it('only ever lets a client update a still-pending proposal', () => {
    const policy = sql.slice(sql.indexOf('create policy "proposals_update"'))
    expect(policy).toMatch(/using \([\s\S]*status = 'pending'[\s\S]*\)\s*with check/)
  })
})
