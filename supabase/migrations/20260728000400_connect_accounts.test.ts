import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '20260728000400_connect_accounts.sql'), 'utf8').toLowerCase()

describe('connect_accounts migration', () => {
  it('creates the table keyed by user with a unique stripe account id', () => {
    expect(sql).toContain('create table if not exists public.connect_accounts')
    expect(sql).toMatch(/stripe_account_id text not null unique/)
  })

  it('tracks onboarding readiness flags', () => {
    expect(sql).toContain('charges_enabled')
    expect(sql).toContain('payouts_enabled')
    expect(sql).toContain('details_submitted')
  })

  it('enables RLS with an own-select policy (writes service-role only)', () => {
    expect(sql).toContain('alter table public.connect_accounts enable row level security')
    expect(sql).toMatch(/connect_accounts_select_own[\s\S]*user_id = auth\.uid\(\)/)
    expect(sql).not.toMatch(/for insert|for update/)
  })
})
