import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PM-34 — the public-bucket SELECT policy on storage.objects was open to `anon`,
// which authorises the LIST operation and let unauthenticated callers enumerate
// every user's `<uid>/` folder in avatars/logos/covers.

const sql = readFileSync(
  join(__dirname, '20260904001001_public_bucket_no_anon_listing.sql'),
  'utf8',
).toLowerCase()

// Executable SQL only — the header comment quotes the OLD (anon-readable)
// policy verbatim, so comment lines must be stripped before asserting on grants.
const code = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe('public bucket no anon listing migration', () => {
  it('replaces the existing public-bucket SELECT policy rather than adding a second one', () => {
    expect(sql).toContain(
      'drop policy if exists "podium_storage_objects_select_public_buckets" on storage.objects',
    )
    expect(sql).toContain('create policy "podium_storage_objects_select_public_buckets"')
  })

  it('restricts the recreated policy to authenticated only, not anon', () => {
    // The recreated policy targets authenticated only.
    expect(code).toMatch(/for select\s*\n\s*to authenticated/)
    // No executable grant to anon remains (comments are stripped in `code`).
    expect(code).not.toContain('to anon')
  })

  it('still scopes to the three public image buckets', () => {
    expect(sql).toContain("'avatars', 'logos', 'covers'")
  })

  it('guards the storage-owner DDL so a privilege failure downgrades to a warning', () => {
    expect(sql).toContain("to_regclass('storage.objects')")
    expect(sql).toContain('when insufficient_privilege then')
    expect(sql).toContain('raise warning')
  })
})
