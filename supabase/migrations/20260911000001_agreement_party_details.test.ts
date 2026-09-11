import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260911000001_agreement_party_details.sql'),
  'utf8'
)

describe('20260911000001_agreement_party_details', () => {
  it('adds address + representative columns to brand_profiles', () => {
    expect(sql).toMatch(/alter table public\.brand_profiles/)
    expect(sql).toMatch(/add column if not exists registered_address text/)
    expect(sql).toMatch(/add column if not exists representative_name text/)
    expect(sql).toMatch(/add column if not exists representative_title text/)
  })
  it('adds address to athlete_profiles and team_profiles', () => {
    expect(sql).toMatch(/alter table public\.athlete_profiles[\s\S]*add column if not exists address text/)
    expect(sql).toMatch(/alter table public\.team_profiles[\s\S]*add column if not exists registered_address text/)
  })
})
