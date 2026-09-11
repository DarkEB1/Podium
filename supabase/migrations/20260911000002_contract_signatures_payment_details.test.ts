import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260911000002_contract_signatures_payment_details.sql'),
  'utf8'
)

describe('20260911000002_contract_signatures_payment_details', () => {
  it('adds a nullable payment_details jsonb column to contract_signatures', () => {
    expect(sql).toMatch(/alter table public\.contract_signatures/)
    expect(sql).toMatch(/add column if not exists payment_details jsonb/)
  })

  it('does not add a write policy (writes stay service-role only)', () => {
    // The existing contract_signatures_select policy already scopes reads to
    // participants + admin; this additive column must not open a client write.
    expect(sql).not.toMatch(/create policy/i)
  })
})
