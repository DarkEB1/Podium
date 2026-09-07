import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-ADMIN-01 — admin reject of an athlete wrote 'deactivated', the same value
// the athlete's own toggle uses, so the athlete could re-publish and undo it.
// A distinct 'suspended' status gives rejection a state the athlete cannot
// leave (enforced by 20260904000902).

const sql = readFileSync(
  join(__dirname, '20260904000901_profile_status_suspended.sql'),
  'utf8',
).toLowerCase()

describe('profile_status suspended value migration', () => {
  it('adds the suspended value to profile_status', () => {
    expect(sql).toContain('alter type public.profile_status add value')
    expect(sql).toContain("'suspended'")
  })

  it('is idempotent (if not exists)', () => {
    expect(sql).toContain('add value if not exists')
  })

  it('does not use the new value in the same migration', () => {
    // ADD VALUE cannot be used in its own transaction; the trigger that
    // references it lives in the next migration.
    expect(sql).not.toContain('create trigger')
    expect(sql).not.toContain('create or replace function')
  })
})
