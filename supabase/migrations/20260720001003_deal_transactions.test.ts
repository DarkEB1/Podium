import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SB-8 / DI-2 (atomic accept -> contract with terms snapshot) and
// SB-7 (atomic counter-proposal).

const sql = readFileSync(
  join(__dirname, '20260720001003_deal_transactions.sql'),
  'utf8',
).toLowerCase()

function functionBody(name: string): string {
  const match = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
  ).exec(sql)
  return match ? match[0] : ''
}

describe('SB-8/DI-2 + SB-7 deal_transactions migration', () => {
  it('adds the contract terms snapshot column idempotently', () => {
    expect(sql).toMatch(/add column if not exists terms_snapshot jsonb/)
    expect(sql).toContain('comment on column public.contracts.terms_snapshot is')
  })

  it('makes one contract per proposal so accept is safely re-runnable', () => {
    expect(sql).toMatch(
      /create unique index if not exists contracts_proposal_id_key\s*\n?\s*on public\.contracts \(proposal_id\)/,
    )
    expect(sql).toContain('on conflict (proposal_id) do nothing')
  })

  describe('accept_proposal', () => {
    const body = functionBody('accept_proposal')

    it('is SECURITY DEFINER with a pinned search_path', () => {
      expect(body).toContain('security definer set search_path = public')
    })

    it('verifies the caller is a match participant', () => {
      expect(body).toContain('v_match.user_a_id <> v_caller and v_match.user_b_id <> v_caller')
    })

    it('rejects the proposal sender responding to themselves', () => {
      expect(body).toContain('v_proposal.sender_id = v_caller')
    })

    it('requires the proposal to be pending', () => {
      expect(body).toContain("v_proposal.status <> 'pending'")
    })

    it('updates the proposal and inserts the contract in the same function', () => {
      expect(body).toMatch(/update public\.proposals[\s\S]*?insert into public\.contracts/)
      expect(body).toContain("set status = 'accepted'")
      expect(body).toContain('responded_at = now()')
    })

    it('snapshots every economic term onto the contract', () => {
      for (const term of [
        'deliverables',
        'pay_amount',
        'pay_currency',
        'pay_type',
        'timeline_start',
        'timeline_end',
        'usage_rights',
        'additional_terms',
      ]) {
        expect(body, `terms_snapshot is missing ${term}`).toContain(`v_proposal.${term}`)
      }
    })

    it('locks the proposal row to serialise concurrent responses', () => {
      expect(body).toContain('for update')
    })

    it('is executable by authenticated users only', () => {
      expect(sql).toContain('revoke all on function public.accept_proposal(uuid) from public')
      expect(sql).toContain(
        'grant execute on function public.accept_proposal(uuid) to authenticated, service_role',
      )
    })
  })

  describe('counter_proposal', () => {
    const body = functionBody('counter_proposal')

    it('is SECURITY DEFINER with a pinned search_path', () => {
      expect(body).toContain('security definer set search_path = public')
    })

    it("marks the parent 'countered' and inserts the child in one transaction", () => {
      expect(body).toMatch(
        /update public\.proposals[\s\S]*?set status = 'countered'[\s\S]*?insert into public\.proposals/,
      )
      expect(body).toContain('parent_proposal_id')
    })

    it('rejects the parent sender countering their own proposal', () => {
      expect(body).toContain('v_parent.sender_id = v_caller')
    })

    it('requires the parent to be pending and the caller to be a participant', () => {
      expect(body).toContain("v_parent.status <> 'pending'")
      expect(body).toContain('v_match.user_a_id <> v_caller and v_match.user_b_id <> v_caller')
    })

    it('takes the sender from auth.uid(), never from a client argument', () => {
      expect(body).toMatch(/v_caller\s+uuid := auth\.uid\(\)/)
      expect(body).not.toContain('p_sender_id')
    })
  })
})
