import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-1 — `users_update_own` enforced the role LOCK but never constrained the
// role VALUE, and every account starts unlocked, so any user could PATCH
// themselves to role='admin' straight through PostgREST with the anon key.

const sql = readFileSync(
  join(__dirname, '20260805000000_admin_role_not_self_assignable.sql'),
  'utf8',
).toLowerCase()

describe('admin role not self-assignable migration', () => {
  it('replaces the users_update_own policy rather than adding a second one', () => {
    expect(sql).toContain('drop policy if exists "users_update_own" on public.users')
    expect(sql).toMatch(/create policy "users_update_own"\s*\n\s*on public\.users for update/)
  })

  it('refuses a self-update that writes the admin role', () => {
    expect(sql).toContain("role is distinct from 'admin'")
  })

  it('still lets an existing admin update their own row', () => {
    expect(sql).toMatch(
      /or \(select u\.role from public\.users u where u\.id = \(select auth\.uid\(\)\)\) = 'admin'/,
    )
  })

  it('keeps the L-7 role lock intact in the redefined trigger function', () => {
    expect(sql).toMatch(/if old\.role_locked_at is null then\s*\n\s*return new;/)
    expect(sql).toContain('new.role is distinct from old.role')
    expect(sql).toContain('new.role_locked_at is distinct from old.role_locked_at')
    expect(sql).toContain('role_already_locked')
  })

  it('blocks admin escalation in the trigger for authenticated and anon JWTs', () => {
    expect(sql).toContain('admin_role_not_self_assignable')
    expect(sql).toMatch(/jwt_role in \('authenticated', 'anon'\)/)
    expect(sql).toContain("new.role = 'admin'")
    expect(sql).toContain("old.role is distinct from 'admin'")
  })

  // The service role is how a real admin is provisioned; blocking it would make
  // it impossible to create the first admin.
  it('leaves the service role able to grant admin', () => {
    expect(sql).not.toMatch(/jwt_role in \([^)]*service_role/)
  })

  it('reads the JWT claim defensively so a missing or malformed context cannot throw', () => {
    expect(sql).toContain("nullif(current_setting('request.jwt.claims', true), '')")
    expect(sql).toContain('exception when others then')
  })
})
