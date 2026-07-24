import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-3 — all four buckets were public and SELECT was granted to anon, so
// anyone could read AND enumerate every user's folder, including team media
// packs and sponsorship briefs in `docs`.
// SEC-4 — the policy DDL was unguarded and would abort the whole migration on
// a database where the migration role does not own storage.objects.
//
// Text assertions only: whether the policy DDL actually succeeds against a
// given project's privileges can only be established live.

const sql = readFileSync(
  join(__dirname, '20260720005002_storage_bucket_visibility.sql'),
  'utf8'
).toLowerCase()

/** Executable statements only — the header comments quote the defective code. */
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

describe('SEC-3/SEC-4 storage bucket visibility migration', () => {
  it('keeps the image buckets public and makes docs private', () => {
    for (const b of ['avatars', 'logos', 'covers']) {
      expect(sql, `${b} should stay public`).toMatch(new RegExp(`\\('${b}',\\s*'${b}',\\s*true,`))
    }
    expect(sql).toMatch(/\('docs',\s*'docs',\s*false,/)
  })

  it('corrects pre-existing bucket rows instead of skipping them', () => {
    expect(sql).toContain('on conflict (id) do update')
    expect(sql).toContain('public             = excluded.public')
    expect(code).not.toContain('on conflict (id) do nothing')
  })

  it('drops the blanket anon-readable select policy', () => {
    expect(sql).toContain('drop policy if exists "podium_storage_objects_select_public"')
  })

  it('scopes the docs select policy to authenticated owners and counterparties', () => {
    const docs = sql.slice(sql.indexOf('podium_storage_objects_select_docs'))
    expect(docs).toContain('to authenticated')
    expect(docs).toContain('public.can_read_user_folder((storage.foldername(name))[1])')
  })

  it('guards the storage DDL so a permission error cannot abort the migration', () => {
    expect(sql).toContain("to_regclass('storage.objects')")
    expect(sql).toContain("to_regclass('storage.buckets')")
    expect(sql).toContain('when insufficient_privilege then')
    expect(sql).toContain('raise warning')
  })
})
