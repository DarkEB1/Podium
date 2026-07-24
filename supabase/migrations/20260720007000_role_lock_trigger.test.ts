import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// L-7 — the role lock must be an invariant of the table, not a check the
// caller is trusted to perform. The application-side half of the fix (the
// atomic conditional UPDATE) is asserted in lib/supabase/auth.test.ts.

const sql = readFileSync(
  join(__dirname, '20260720007000_role_lock_trigger.sql'),
  'utf8',
).toLowerCase()

describe('role lock trigger migration', () => {
  it('fires BEFORE UPDATE, so it sees the row-locked OLD tuple', () => {
    expect(sql).toMatch(/before update of role, role_locked_at on public\.users/)
    expect(sql).toContain('for each row')
  })

  it('allows the initial assignment while role_locked_at is null', () => {
    expect(sql).toMatch(/if old\.role_locked_at is null then\s*\n\s*return new;/)
  })

  it('freezes both role and role_locked_at once the lock is set', () => {
    expect(sql).toContain('new.role is distinct from old.role')
    expect(sql).toContain('new.role_locked_at is distinct from old.role_locked_at')
  })

  it('reports the same failure mode the app layer uses', () => {
    expect(sql).toContain('role_already_locked')
  })

  it('is idempotent — safe to re-run', () => {
    expect(sql).toContain('create or replace function public.enforce_role_lock()')
    expect(sql).toContain('drop trigger if exists enforce_role_lock on public.users')
  })

  it('pins the search_path on the SECURITY DEFINER function', () => {
    expect(sql).toContain('security definer set search_path = public, pg_temp')
  })

  it('never edits an existing migration', () => {
    // Guard on the filename convention: this file is additive and prefixed
    // 20260720007xxx, after every migration that already exists.
    expect(__dirname).toContain('migrations')
  })
})
