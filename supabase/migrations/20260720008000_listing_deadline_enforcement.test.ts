import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// These are text assertions over the migration, not executed SQL — this repo has
// no database available to the test suite. They pin the properties that make the
// migration safe to deploy; the runtime behaviour needs a live database.

const sql = readFileSync(
  join(__dirname, '20260720008000_listing_deadline_enforcement.sql'),
  'utf8'
).toLowerCase()

describe('L-6 / DI-3 listing deadline enforcement migration', () => {
  it('adds the discovery feed index idempotently and partially', () => {
    expect(sql).toContain('create index if not exists job_listings_active_feed_idx')
    expect(sql).toContain("where status = 'active'")
  })

  it('indexes created_at desc so the feed ordering is answered from the index', () => {
    expect(sql).toMatch(/on public\.job_listings \(created_at desc, application_deadline\)/)
  })

  it('transitions listings to the existing expired status rather than deleting them', () => {
    expect(sql).toContain("set status = 'expired'")
    expect(sql).not.toMatch(/\bdelete\s+from\b/)
    expect(sql).not.toMatch(/\bdrop\s+table\b/)
    expect(sql).not.toMatch(/\btruncate\b/)
  })

  it('never cascades into any table other than job_listings', () => {
    const updatedTables = sql.match(/update\s+public\.(\w+)/g) ?? []
    expect(updatedTables.every((t) => t.endsWith('job_listings'))).toBe(true)
  })

  it('treats the deadline as inclusive of its own day, matching the feed predicate', () => {
    // application_deadline is timestamptz but is written from an <input type="date">,
    // i.e. midnight UTC at the start of the day. Comparing against now() would
    // expire a listing on its own deadline day.
    expect(sql).toContain("date_trunc('day'")
    expect(sql).toContain('application_deadline < v_cutoff')
    expect(sql).not.toMatch(/application_deadline\s*<\s*now\(\)/)
  })

  it('skips listings that have no deadline at all', () => {
    expect(sql).toContain('application_deadline is not null')
  })

  it('bounds the sweep and does not block on rows another worker holds', () => {
    expect(sql).toContain('limit p_limit')
    expect(sql).toContain('for update skip locked')
    expect(sql).toContain('p_limit > 5000')
  })

  it('pins search_path on the security definer function', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public, pg_temp')
  })

  it('is service-role only — no authenticated or anon caller may sweep listings', () => {
    expect(sql).toContain(
      'revoke all on function public.expire_listings_past_deadline(integer) from public'
    )
    expect(sql).toContain(
      'revoke all on function public.expire_listings_past_deadline(integer) from anon'
    )
    expect(sql).toContain(
      'revoke all on function public.expire_listings_past_deadline(integer) from authenticated'
    )
  })

  it('is re-runnable (create or replace + if not exists)', () => {
    expect(sql).toContain('create or replace function public.expire_listings_past_deadline')
  })
})
