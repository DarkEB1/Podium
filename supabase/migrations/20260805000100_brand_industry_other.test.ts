import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// QA-2 — the brand onboarding form sent `industry_other` to a column that did
// not exist, so PostgREST rejected the whole of step 2.

const sql = readFileSync(
  join(__dirname, '20260805000100_brand_industry_other.sql'),
  'utf8',
).toLowerCase()

describe('brand industry_other migration', () => {
  it('adds industry_other to brand_profiles', () => {
    expect(sql).toMatch(/alter table public\.brand_profiles\s*\n\s*add column if not exists industry_other text/)
  })

  // Backward compatibility: the migration is applied to production BEFORE the
  // code that writes the column ships, so it must be a no-op for live code.
  it('is nullable with no default, so existing rows and older deploys are unaffected', () => {
    expect(sql).not.toMatch(/industry_other text[^;]*not null/)
    expect(sql).not.toMatch(/industry_other text[^;]*default/)
  })

  it('is idempotent', () => {
    expect(sql).toContain('if not exists')
  })
})
