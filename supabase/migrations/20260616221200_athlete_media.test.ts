import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B2 — Athlete media migration. No live DB in the Vitest (jsdom) suite, so we
// assert the migration SQL is well-formed and idempotent, and that the
// availability display-label audit is documented for downstream consumer tasks.
const MIGRATION = '20260616221200_athlete_media.sql'

function readMigration(): string {
  return readFileSync(join(__dirname, MIGRATION), 'utf8')
}

describe('B2 athlete_media migration', () => {
  const sql = readMigration()
  const normalised = sql.toLowerCase()

  it('targets the athlete_profiles table', () => {
    expect(normalised).toContain('alter table public.athlete_profiles')
  })

  it('adds profile_photo_url as text, idempotently', () => {
    expect(normalised).toMatch(
      /add column if not exists profile_photo_url\s+text/,
    )
  })

  it('adds action_photos as a text[] array, idempotently', () => {
    expect(normalised).toMatch(
      /add column if not exists action_photos\s+text\[\]/,
    )
  })

  it('adds highlight_videos as a text[] array, idempotently', () => {
    expect(normalised).toMatch(
      /add column if not exists highlight_videos\s+text\[\]/,
    )
  })

  it('every added array column has a non-null default of empty array', () => {
    for (const col of ['action_photos', 'highlight_videos']) {
      const re = new RegExp(
        `add column if not exists ${col}\\s+text\\[\\]\\s+not null default '\\{\\}'`,
      )
      expect(normalised).toMatch(re)
    }
  })

  it('makes no schema change for availability labels (display-only)', () => {
    // The availability_status enum is fixed in 20260419000001_users_auth.sql.
    // This migration documents the labels but must not run any enum/type DDL.
    expect(normalised).not.toMatch(/create\s+type/)
    expect(normalised).not.toMatch(/alter\s+type/)
    expect(normalised).not.toMatch(/drop\s+type/)
  })

  it('documents the availability display-label audit for consumer tasks', () => {
    // The three enum values must map to these exact human-readable labels
    // wherever availability is rendered (profile card, admin view, brand feed).
    expect(sql).toContain("available_now -> 'Available Now'")
    expect(sql).toContain("available_from -> 'Available From [date]'")
    expect(sql).toContain(
      "not_available -> 'Not Currently Taking New Work'",
    )
  })
})
