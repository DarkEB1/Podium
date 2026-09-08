import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260907000002_contracts_document_hash.sql'),
  'utf8'
)

describe('20260907000002_contracts_document_hash', () => {
  it('adds document_hash to contracts', () => {
    expect(sql).toMatch(/alter table public\.contracts/)
    expect(sql).toMatch(/add column if not exists document_hash text/)
  })
})
