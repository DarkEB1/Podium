import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR-16 — photo upload failed on row-level security because the storage
// buckets were never created outside supabase/config.toml and storage.objects
// had RLS on with zero policies.

const sql = readFileSync(
  join(__dirname, '20260720001005_storage_buckets_policies.sql'),
  'utf8',
).toLowerCase()

const BUCKETS = ['avatars', 'logos', 'covers', 'docs']

describe('PR-16 storage_buckets_policies migration', () => {
  it('creates all four v1 buckets idempotently', () => {
    expect(sql).toContain('insert into storage.buckets')
    for (const b of BUCKETS) {
      expect(sql, `bucket ${b} not created`).toMatch(
        new RegExp(`\\('${b}',\\s*'${b}',\\s*(true|false),`),
      )
    }
    expect(sql).toContain('on conflict (id) do nothing')
  })

  it('defines insert, update, delete and select policies on storage.objects', () => {
    for (const action of ['select', 'insert', 'update', 'delete']) {
      expect(sql, `no ${action} policy`).toMatch(
        new RegExp(`on storage\\.objects for ${action}`),
      )
    }
  })

  it('restricts every write to the caller\'s own first path segment', () => {
    const writes = sql
      .split('drop policy')
      .filter((chunk) => /for (insert|update|delete)/.test(chunk))
    expect(writes.length).toBe(3)
    for (const chunk of writes) {
      expect(chunk).toContain("(storage.foldername(name))[1] = auth.uid()::text")
      expect(chunk).toContain('to authenticated')
    }
  })

  it('keeps SELECT public for the public buckets', () => {
    expect(sql).toMatch(
      /create policy "podium_storage_objects_select_public"[\s\S]*?using \(bucket_id in \('avatars', 'logos', 'covers', 'docs'\)\)/,
    )
  })

  it('is re-runnable (drops each policy first)', () => {
    expect(sql.match(/drop policy if exists "podium_storage_objects_/g)?.length).toBe(4)
  })

  it('documents how a future private bucket must be handled', () => {
    expect(sql).toContain('private bucket')
  })
})
