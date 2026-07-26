import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-9 — get_conversations() hard-filtered status = 'active', so an archived
// conversation could never be found and therefore never un-archived; and the
// counterparty-name LATERAL had no ORDER BY, so a user with two profile rows
// saw the inbox name flip between loads.

const sql = readFileSync(
  join(__dirname, '20260720005006_conversations_archived_and_determinism.sql'),
  'utf8'
).toLowerCase()

describe('SEC-9 inbox migration', () => {
  it('drops the zero-argument function before adding the defaulted one', () => {
    expect(sql.indexOf('drop function if exists public.get_conversations();')).toBeLessThan(
      sql.indexOf('create function public.get_conversations(p_include_archived')
    )
  })

  it('exposes archived conversations behind a defaulted parameter', () => {
    expect(sql).toContain('p_include_archived boolean default false')
    expect(sql).toContain("coalesce(p_include_archived, false) and m.status = 'archived'")
  })

  it('never returns blocked matches', () => {
    const body = sql.slice(sql.indexOf('with my_matches'))
    expect(body).not.toContain("m.status = 'blocked'")
  })

  it('resolves the counterparty deterministically', () => {
    expect(sql).toContain('source_priority')
    expect(sql).toContain('order by p.source_priority asc, p.display_name asc')
  })

  it('keeps participant_display away from client roles', () => {
    expect(sql).toContain('revoke all on public.participant_display from public')
  })
})
