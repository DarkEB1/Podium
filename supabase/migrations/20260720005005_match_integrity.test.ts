import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-8 — matches_update let a participant swap the OTHER side for an arbitrary
// victim (manufacturing a messaging + proposal channel); re-acceptance never
// revived an archived match; and matches_canonical_pair was left NOT VALID over
// rows that would throw 23514 on their next UPDATE.
//
// Text assertions only — the duplicate-mirror merge in step 1 can only be
// exercised against real data.

const sql = readFileSync(join(__dirname, '20260720005005_match_integrity.sql'), 'utf8').toLowerCase()

describe('SEC-8 match integrity migration', () => {
  it('pins both participant columns with a BEFORE UPDATE trigger', () => {
    expect(sql).toContain('create or replace function public.enforce_match_immutable_participants()')
    expect(sql).toMatch(/new\.user_a_id is distinct from old\.user_a_id/)
    expect(sql).toMatch(/new\.user_b_id is distinct from old\.user_b_id/)
    expect(sql).toMatch(/before update on public\.matches/)
    expect(sql).toContain("errcode = 'pd012'")
  })

  it('revives an archived match on re-acceptance but never a blocked one', () => {
    expect(sql).toContain('on conflict (user_a_id, user_b_id) do update')
    expect(sql).toContain("set status                = 'active'")
    expect(sql).toContain("where matches.status <> 'blocked'")
  })

  it('merges legacy duplicates and re-adds the canonical constraint VALIDATED', () => {
    expect(sql).toContain('update public.messages    set match_id = v_dupe.keep_id')
    expect(sql).toContain('update public.contracts   set match_id = v_dupe.keep_id')
    expect(sql).toMatch(
      /add constraint matches_canonical_pair check \(user_a_id < user_b_id\);/
    )
  })

  it('re-enables the proposals immutability trigger it had to step around', () => {
    const disables = sql.match(/disable trigger proposals_enforce_immutable_columns/g) ?? []
    const enables = sql.match(/enable trigger proposals_enforce_immutable_columns/g) ?? []
    expect(disables.length).toBe(1)
    expect(enables.length).toBeGreaterThanOrEqual(disables.length)
  })
})
