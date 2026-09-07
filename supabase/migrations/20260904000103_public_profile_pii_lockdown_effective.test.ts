import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-SEC-01 (P0) — the 000101 column-level REVOKE was a no-op because anon holds a
// table-level SELECT grant. This migration drops the table grant and re-grants only
// the safe public columns. Verified live on staging after apply.

const raw = readFileSync(
  join(__dirname, '20260904000103_public_profile_pii_lockdown_effective.sql'),
  'utf8',
).toLowerCase()
const sql = raw
// executable SQL only — drop `--` comment lines (they legitimately name the
// sensitive columns when explaining why the earlier migration was a no-op).
const executableSql = raw
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

const TABLES = ['athlete_profiles', 'team_profiles', 'brand_profiles', 'agent_profiles']
const SENSITIVE = [
  'full_legal_name', 'date_of_birth', 'payout_account_last4', 'sort_code_last4',
  'stripe_connect_account_id', 'guardian_email', 'registration_number', 'vat_number',
]

describe('effective anon PII lockdown migration', () => {
  it('drops the table-wide anon SELECT and re-grants a column subset on every profile table', () => {
    for (const t of TABLES) {
      expect(sql, t).toContain(`revoke select on public.${t} from anon`)
      expect(sql, t).toMatch(new RegExp(`grant select \\([^)]*\\)\\s*on public\\.${t} to anon`))
    }
  })

  it('never grants a sensitive/financial/PII column to anon', () => {
    for (const col of SENSITIVE) {
      expect(executableSql, col).not.toContain(col)
    }
  })

  it('leaves the authenticated role untouched (owner self-service still works)', () => {
    expect(sql).not.toContain('from authenticated')
    expect(sql).not.toContain('to authenticated')
  })
})
