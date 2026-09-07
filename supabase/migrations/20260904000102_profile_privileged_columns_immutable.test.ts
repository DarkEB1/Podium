import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-SEC-03 — the *_profiles UPDATE policies gate the row but not the columns,
// so an owner could self-approve (brand status), self-consent (athlete
// guardian_accepted_at), self-lie about age (is_under_18), or self-verify
// (agent verification_status) straight through PostgREST. A BEFORE UPDATE
// trigger freezes those transitions for JWT callers only.

const sql = readFileSync(
  join(__dirname, '20260904000102_profile_privileged_columns_immutable.sql'),
  'utf8',
).toLowerCase()

describe('profile privileged columns immutable migration', () => {
  it('only constrains authenticated and anon JWT callers', () => {
    expect(sql).toMatch(/jwt_role not in \('authenticated', 'anon'\)/)
    // service_role is how these columns are legitimately written; it must not be
    // named as a constrained role.
    expect(sql).not.toMatch(/jwt_role\s+in\s+\([^)]*service_role/)
  })

  it('reads the JWT claim defensively so a missing/malformed context cannot throw', () => {
    expect(sql).toContain("nullif(current_setting('request.jwt.claims', true), '')")
    expect(sql).toContain('exception when others then')
  })

  it('freezes athlete guardian_accepted_at and direct is_under_18 changes', () => {
    expect(sql).toContain('guardian_accepted_at')
    // is_under_18 blocked only when date_of_birth is unchanged (else it is the
    // derive trigger legitimately recomputing it).
    expect(sql).toMatch(/is_under_18[\s\S]*?date_of_birth[\s\S]*?is not distinct from/)
  })

  it('freezes brand status and admin_approved_* (admin-review only)', () => {
    expect(sql).toMatch(/tg_table_name = 'brand_profiles'[\s\S]*?'status'[\s\S]*?is distinct from/)
    expect(sql).toContain('admin_approved_at')
    expect(sql).toContain('admin_approved_by')
  })

  it('freezes only the agent verified-grant, not the self-apply to pending', () => {
    expect(sql).toMatch(/\(newj ->> 'verification_status'\) = 'verified'/)
    expect(sql).toMatch(/\(newj ->> 'is_verified'\) = 'true'/)
    // Nothing may block a move to 'pending' — that is the legitimate self-apply.
    expect(sql).not.toContain("= 'pending'")
  })

  it('does NOT freeze status on athlete/agent (they self-publish)', () => {
    // The only per-table `status` freeze is under brand_profiles.
    const statusFreezes = sql.match(/\(newj ->> 'status'\) is distinct from/g) ?? []
    expect(statusFreezes.length).toBe(1)
  })

  it('installs a BEFORE UPDATE trigger on athlete, brand and agent profiles', () => {
    for (const table of ['athlete_profiles', 'brand_profiles', 'agent_profiles']) {
      expect(sql).toMatch(
        new RegExp(`before update on public\\.${table}\\s*\\n\\s*for each row execute procedure`),
      )
    }
  })

  it('is idempotent (drops each trigger before recreating it)', () => {
    expect(sql).toMatch(/drop trigger if exists athlete_profiles_privileged_columns_immutable/)
    expect(sql).toMatch(/drop trigger if exists brand_profiles_privileged_columns_immutable/)
    expect(sql).toMatch(/drop trigger if exists agent_profiles_privileged_columns_immutable/)
  })
})
