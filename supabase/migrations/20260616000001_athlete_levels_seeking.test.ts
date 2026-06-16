import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// B1 — athlete levels + NIL/seeking migration contract (plan §1.5 B1, spec §3A.3/§3A.6).
// Migration-only task: no live DB in CI, so we assert the SQL DDL the migration must contain.
// These assertions lock the EXACT enum values and column names every downstream pod (AT4, B7) consumes.

const sql = readFileSync(
  path.resolve(__dirname, '20260616000001_athlete_levels_seeking.sql'),
  'utf8',
)

describe('B1 athlete_level enum extension', () => {
  it('adds the three new levels to athlete_level (8 total)', () => {
    // 3 new values appended; ADD VALUE IF NOT EXISTS keeps the migration idempotent.
    for (const v of ['university_bucs', 'academy', 'national']) {
      expect(sql).toMatch(
        new RegExp(`alter type public\\.athlete_level add value if not exists '${v}'`, 'i'),
      )
    }
  })

  it('does not redeclare the original five levels (extend, not recreate)', () => {
    expect(sql).not.toMatch(/create type public\.athlete_level/i)
  })
})

describe('B1 seeking_type enum (10 NIL values)', () => {
  const SEEKING_VALUES = [
    'product_gifting',
    'paid_partnership',
    'brand_ambassador',
    'social_content',
    'event_appearance',
    'affiliate_code',
    'equipment_sponsorship',
    'nutrition_supplement',
    'apparel_deal',
    'university_nil_collective',
  ]

  it('creates seeking_type as an enum', () => {
    expect(sql).toMatch(/create type public\.seeking_type as enum/i)
  })

  it('defines exactly the ten locked NIL values', () => {
    for (const v of SEEKING_VALUES) {
      expect(sql).toMatch(new RegExp(`'${v}'`))
    }
    const enumBlock = sql.match(
      /create type public\.seeking_type as enum\s*\(([\s\S]*?)\)/i,
    )
    expect(enumBlock).not.toBeNull()
    const quoted = (enumBlock?.[1] ?? '').match(/'[^']+'/g) ?? []
    expect(quoted).toHaveLength(10)
  })
})

describe('B1 athlete_profiles column additions', () => {
  it('adds university_team, highest_level, academy_club, national_programme', () => {
    expect(sql).toMatch(
      /alter table public\.athlete_profiles\s+add column if not exists university_team\s+text/i,
    )
    expect(sql).toMatch(
      /alter table public\.athlete_profiles\s+add column if not exists highest_level\s+public\.athlete_level/i,
    )
    expect(sql).toMatch(
      /alter table public\.athlete_profiles\s+add column if not exists academy_club\s+text/i,
    )
    expect(sql).toMatch(
      /alter table public\.athlete_profiles\s+add column if not exists national_programme\s+text/i,
    )
  })

  it('converts athlete_profiles.seeking to seeking_type[] (was text[])', () => {
    expect(sql).toMatch(
      /alter table public\.athlete_profiles[\s\S]*?alter column seeking[\s\S]*?type public\.seeking_type\[\]/i,
    )
  })
})
