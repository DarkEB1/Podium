import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// QA-1.1 / QA-1.2 — rescues team and agent profiles stranded in 'draft'.
// Static assertions on the migration SQL (the suite does not run against a live
// Postgres).

const sql = readFileSync(
  join(__dirname, '20260730000000_onboarding_activation_backfill.sql'),
  'utf8',
).toLowerCase()

describe('QA onboarding activation backfill migration', () => {
  it('activates draft team profiles', () => {
    expect(sql).toMatch(/update public\.team_profiles\s+set status = 'active'\s+where status = 'draft'/)
  })

  it('activates draft agent profiles', () => {
    expect(sql).toMatch(/update public\.agent_profiles\s+set status = 'active'\s+where status = 'draft'/)
  })

  it('touches only draft rows, so an admin suspension is never undone', () => {
    const updates = sql.match(/update public\./g) ?? []
    const guards = sql.match(/where status = 'draft'/g) ?? []
    expect(guards).toHaveLength(updates.length)
  })

  it('leaves athlete and brand statuses alone (they have their own flows)', () => {
    expect(sql).not.toContain('update public.athlete_profiles')
    expect(sql).not.toContain('update public.brand_profiles')
  })
})
