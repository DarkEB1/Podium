import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-SEC-01 — the *_profiles SELECT policies gate rows, not columns, so every
// active profile's PII/financial columns were readable with the public anon key
// via PostgREST. This migration revokes SELECT on those columns from `anon`.

const sql = readFileSync(
  join(__dirname, '20260904000101_public_profile_pii_lockdown.sql'),
  'utf8',
).toLowerCase()

describe('public profile PII lockdown migration', () => {
  it('revokes athlete identity/contact PII from anon', () => {
    for (const col of ['full_legal_name', 'date_of_birth', 'phone', 'guardian_email']) {
      expect(sql).toContain(col)
    }
    expect(sql).toMatch(/revoke select \([^)]*full_legal_name[\s\S]*?\)\s*on public\.athlete_profiles from anon/)
  })

  it('revokes athlete payout + Stripe Connect columns from anon', () => {
    for (const col of [
      'payout_bank_name',
      'payout_account_holder',
      'payout_account_last4',
      'payout_sort_code_last4',
      'stripe_connect_account_id',
    ]) {
      expect(sql).toContain(col)
    }
  })

  it('revokes team commercial-manager and primary-controller contact PII from anon', () => {
    expect(sql).toMatch(/revoke select \([^)]*commercial_manager_email[\s\S]*?primary_controller_email[\s\S]*?\)\s*on public\.team_profiles from anon/)
  })

  it('revokes brand registration + VAT numbers from anon', () => {
    expect(sql).toContain('company_registration_number')
    expect(sql).toContain('vat_number')
    expect(sql).toMatch(/on public\.brand_profiles from anon/)
  })

  it('targets the anon role only — owners act as authenticated and must keep access', () => {
    // No revoke may name the authenticated role: owners read their own payout /
    // guardian columns as `authenticated`, and every owner UPDATE ... RETURNING *
    // needs SELECT on those columns.
    expect(sql).not.toMatch(/from\s+authenticated/)
    // service_role must never be stripped either.
    expect(sql).not.toMatch(/from\s+service_role/)
  })

  it('covers all four profile tables', () => {
    for (const table of [
      'public.athlete_profiles',
      'public.team_profiles',
      'public.brand_profiles',
      'public.agent_profiles',
    ]) {
      expect(sql).toContain(table)
    }
  })
})
