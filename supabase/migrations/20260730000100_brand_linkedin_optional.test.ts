import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '20260730000100_brand_linkedin_optional.sql'), 'utf8').toLowerCase()

describe('brand linkedin_url optional migration', () => {
  it('drops the not-null constraint the onboarding form contradicted', () => {
    expect(sql).toContain('alter table public.brand_profiles')
    expect(sql).toContain('alter column linkedin_url drop not null')
  })

  // Adding a default would paper over the mismatch instead of resolving it, and
  // would write a fake URL into every brand row that left the field blank.
  it('does not invent a default value', () => {
    expect(sql).not.toMatch(/linkedin_url set default/)
  })
})
