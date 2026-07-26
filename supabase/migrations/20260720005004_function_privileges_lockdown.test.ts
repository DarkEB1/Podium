import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-7 (critical) — `revoke all ... from public` does NOT remove the explicit
// anon/authenticated EXECUTE grants Supabase's default privileges attach to
// every function created in schema public. erase_user_data() was therefore
// callable with nothing but the anon key.
//
// This asserts the migration TEXT. The only way to prove the ACLs are actually
// right is `select proacl from pg_proc` on a live database.

const dir = __dirname
const sql = readFileSync(
  join(dir, '20260720005004_function_privileges_lockdown.sql'),
  'utf8'
).toLowerCase()

describe('SEC-7 function privileges lockdown migration', () => {
  it('revokes from anon and authenticated, not just public', () => {
    expect(sql).toMatch(/revoke all on function %s from anon/)
    expect(sql).toMatch(/revoke all on function %s from authenticated/)
  })

  it('locks the erasure and rate-limit functions to the service role', () => {
    const serviceOnly = sql.slice(
      sql.indexOf('v_service_only'),
      sql.indexOf('v_authenticated')
    )
    for (const fn of [
      'erase_user_data',
      'process_scheduled_deletions',
      'check_rate_limit',
      'reset_rate_limit',
      'purge_expired_rate_limits',
    ]) {
      expect(serviceOnly, `${fn} not locked to service_role`).toContain(fn)
    }
  })

  it('keeps the browser-callable RPCs available to authenticated', () => {
    const clientCallable = sql.slice(
      sql.indexOf('v_authenticated'),
      sql.indexOf('v_internal')
    )
    for (const fn of [
      'accept_proposal',
      'counter_proposal',
      'mark_match_read',
      'get_conversations',
    ]) {
      expect(clientCallable, `${fn} missing`).toContain(fn)
    }
    expect(sql).toMatch(/grant execute on function %s to authenticated/)
  })

  it('is re-runnable: every statement is guarded on the object existing', () => {
    expect(sql).toContain('to_regprocedure(v_fn) is null')
    expect(sql).toContain("from pg_roles where rolname = 'anon'")
  })
})
