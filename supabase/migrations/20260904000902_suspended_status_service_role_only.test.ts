import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-ADMIN-01 — the 'suspended' status must be writable only by the service
// role, so a rejected athlete cannot re-publish (publishProfile runs under the
// owner JWT and sets status='active').

const sql = readFileSync(
  join(__dirname, '20260904000902_suspended_status_service_role_only.sql'),
  'utf8',
).toLowerCase()

describe('suspended status service-role-only migration', () => {
  it('defines the enforcement function', () => {
    expect(sql).toContain('create or replace function public.enforce_suspended_status_service_role_only()')
  })

  it('blocks JWT callers (authenticated and anon) from crossing the suspended boundary', () => {
    expect(sql).toMatch(/jwt_role in \('authenticated', 'anon'\)/)
    expect(sql).toContain("new.status = 'suspended'")
    expect(sql).toContain("old.status = 'suspended'")
    expect(sql).toContain('new.status is distinct from old.status')
  })

  it('raises rather than silently allowing the write', () => {
    expect(sql).toContain('raise exception')
  })

  it('leaves the service role able to suspend and un-suspend', () => {
    // Only authenticated/anon are constrained; service_role must not appear in
    // the blocked-role list.
    expect(sql).not.toMatch(/jwt_role in \([^)]*service_role/)
  })

  it('reads the JWT claim defensively so a missing context cannot throw', () => {
    expect(sql).toContain("nullif(current_setting('request.jwt.claims', true), '')")
    expect(sql).toContain('exception when others then')
  })

  it('installs the trigger on all three profile_status tables', () => {
    expect(sql).toContain('before update on public.athlete_profiles')
    expect(sql).toContain('before update on public.team_profiles')
    expect(sql).toContain('before update on public.agent_profiles')
  })
})
