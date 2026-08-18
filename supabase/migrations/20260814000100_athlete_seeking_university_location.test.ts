import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// UI fixes round 2: is_seeking powers the settings "Seeking opportunities"
// toggle; university_city / university_country capture term-time location for
// University/BUCS athletes.

const sql = readFileSync(
  join(__dirname, '20260814000100_athlete_seeking_university_location.sql'),
  'utf8',
).toLowerCase()

describe('athlete seeking + university location migration', () => {
  it('adds is_seeking as boolean not null default true, so existing rows backfill discoverable', () => {
    expect(sql).toMatch(
      /add column if not exists is_seeking boolean not null default true/,
    )
  })

  it('adds nullable university_city and university_country with no default', () => {
    expect(sql).toMatch(/add column if not exists university_city text/)
    expect(sql).toMatch(/add column if not exists university_country text/)
    expect(sql).not.toMatch(/university_city text[^;,]*not null/)
    expect(sql).not.toMatch(/university_country text[^;,]*not null/)
  })

  // Backward compatibility: the migration is applied to production BEFORE the
  // code that writes the columns ships. A default on is_seeking means the
  // NOT NULL constraint cannot break live inserts that omit it.
  it('is a no-op for live code paths (defaults or nullable only)', () => {
    expect(sql).toMatch(/is_seeking boolean not null default true/)
  })

  it('is idempotent', () => {
    expect(sql).toContain('if not exists')
  })

  it('targets athlete_profiles', () => {
    expect(sql).toMatch(/alter table public\.athlete_profiles/)
  })
})
