import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000003_storage_contract_docs_policy.sql'),
  'utf8'
)

describe('20260907000003_storage_contract_docs_policy', () => {
  it('adds a SELECT policy on storage.objects for the docs bucket', () => {
    expect(sql).toMatch(/create policy select_contract_docs on storage\.objects/)
    expect(sql).toMatch(/for select/)
    expect(sql).toMatch(/bucket_id = 'docs'/)
  })
  it('scopes to the contracts/<id> path and checks participation', () => {
    expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\] = 'contracts'/)
    expect(sql).toMatch(/c\.id::text = \(storage\.foldername\(name\)\)\[2\]/)
    expect(sql).toMatch(/c\.brand_id = auth\.uid\(\)/)
  })
  it('adds no write policy', () => {
    expect(sql).not.toMatch(/for insert/i)
    expect(sql).not.toMatch(/for update/i)
    expect(sql).not.toMatch(/for delete/i)
  })
})
