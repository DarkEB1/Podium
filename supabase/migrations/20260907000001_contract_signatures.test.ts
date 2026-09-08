import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000001_contract_signatures.sql'),
  'utf8'
)

describe('20260907000001_contract_signatures', () => {
  it('creates the table', () => {
    expect(sql).toMatch(/create table public\.contract_signatures/)
  })
  it('enables RLS', () => {
    expect(sql).toMatch(/alter table public\.contract_signatures enable row level security/)
  })
  it('has a participants-or-admin SELECT policy', () => {
    expect(sql).toMatch(/create policy contract_signatures_select/)
    expect(sql).toMatch(/public\.is_admin\(\)/)
    expect(sql).toMatch(/c\.brand_id = auth\.uid\(\)/)
  })
  it('adds NO client write policy', () => {
    expect(sql).not.toMatch(/for insert/i)
    expect(sql).not.toMatch(/for update/i)
    expect(sql).not.toMatch(/for delete/i)
  })
  it('constrains signer_role and is unique per (contract, role)', () => {
    expect(sql).toMatch(/signer_role in \('brand', 'athlete', 'agent'\)/)
    expect(sql).toMatch(/unique \(contract_id, signer_role\)/)
  })
})
