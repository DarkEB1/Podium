import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// QA-1.7 — GDPR exports were uploaded as JSON into an images-and-PDF bucket, so
// every request failed. Static assertions on the migration SQL.

const sql = readFileSync(join(__dirname, '20260730000400_exports_bucket.sql'), 'utf8').toLowerCase()

describe('QA-1.7 exports bucket migration', () => {
  it('creates a private exports bucket that accepts JSON', () => {
    expect(sql).toMatch(/values \('exports', 'exports', false, \d+, array\['application\/json'\]\)/)
  })

  it('corrects a pre-existing bucket rather than skipping it', () => {
    expect(sql).toContain('on conflict (id) do update')
    expect(sql).toContain('allowed_mime_types = excluded.allowed_mime_types')
  })

  it('restricts reads to the owner and admins, with no counterparty access', () => {
    expect(sql).toContain('podium_storage_objects_select_exports')
    expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
    expect(sql).toContain('public.is_admin()')
    // docs lets an active-match counterparty read (via can_read_user_folder);
    // a complete personal-data dump must not. Checked on the policy itself, not
    // the file, since the header comment explains that contrast.
    const policy = sql.slice(sql.indexOf("create policy \"podium_storage_objects_select_exports\""))
    expect(policy).not.toContain('can_read_user_folder')
  })

  it('grants no write policy: exports are written by the service role only', () => {
    expect(sql).not.toMatch(/for insert/)
    expect(sql).not.toMatch(/for update\b/)
    expect(sql).not.toMatch(/for delete/)
  })

  it('guards the storage DDL so a permission error cannot abort the migration', () => {
    expect(sql).toContain("to_regclass('storage.buckets')")
    expect(sql).toContain("to_regclass('storage.objects')")
    expect(sql.match(/when insufficient_privilege then/g) ?? []).toHaveLength(2)
  })
})
