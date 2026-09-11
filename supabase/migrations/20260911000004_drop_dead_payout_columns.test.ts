import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260911000004_drop_dead_payout_columns.sql'),
  'utf8'
)

const COLUMNS = [
  'payout_method',
  'payout_bank_name',
  'payout_account_holder',
  'payout_account_last4',
  'payout_sort_code_last4',
  'payout_country',
  'stripe_connect_account_id',
  'stripe_connect_status',
  'stripe_connect_onboarded_at',
]

describe('20260911000004_drop_dead_payout_columns', () => {
  it('drops every dead payout / stripe_connect column from athlete_profiles', () => {
    expect(sql).toMatch(/alter table public\.athlete_profiles/)
    for (const col of COLUMNS) {
      expect(sql).toMatch(new RegExp(`drop column if exists ${col}\\b`))
    }
  })

  it('drops the now-unused enums', () => {
    expect(sql).toMatch(/drop type if exists public\.payout_method/)
    expect(sql).toMatch(/drop type if exists public\.stripe_connect_status/)
  })
})
