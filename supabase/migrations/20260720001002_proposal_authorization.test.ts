import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// L-1 — proposal accept authorization must live in RLS, not just in
// respondToProposal(). A sender must not be able to accept their own proposal
// through a direct PostgREST call.

const sql = readFileSync(
  join(__dirname, '20260720001002_proposal_authorization.sql'),
  'utf8',
).toLowerCase()

function policyBody(name: string): string {
  const match = new RegExp(
    `create policy "${name}"[\\s\\S]*?;`,
  ).exec(sql)
  return match ? match[0] : ''
}

describe('L-1 proposal_authorization migration', () => {
  it('replaces both proposals policies rather than layering new ones', () => {
    expect(sql).toContain('drop policy if exists "proposals_insert" on public.proposals')
    expect(sql).toContain('drop policy if exists "proposals_update" on public.proposals')
  })

  it('keeps insert open to any match participant, acting as themselves', () => {
    const body = policyBody('proposals_insert')
    expect(body).toContain('sender_id = auth.uid()')
    expect(body).toContain('public.is_match_participant(match_id)')
  })

  it('blocks the sender from responding to their own proposal in USING', () => {
    const body = policyBody('proposals_update')
    const using = body.slice(body.indexOf('using ('), body.indexOf('with check ('))
    expect(using).toContain('public.is_match_participant(match_id)')
    expect(using).toContain('sender_id <> auth.uid()')
  })

  it('blocks the sender from responding to their own proposal in WITH CHECK', () => {
    const body = policyBody('proposals_update')
    const withCheck = body.slice(body.indexOf('with check ('))
    expect(withCheck).toContain('public.is_match_participant(match_id)')
    expect(withCheck).toContain('sender_id <> auth.uid()')
  })

  it('still allows the sender to withdraw their own pending proposal', () => {
    const body = policyBody('proposals_update')
    expect(body).toContain("or status = 'pending'")
    expect(body).toContain("or status = 'withdrawn'")
  })

  it('corrects the stale "brands only" comment about who may create proposals', () => {
    expect(sql).not.toContain('only brands')
    expect(sql).toContain('any match participant may create')
  })
})
