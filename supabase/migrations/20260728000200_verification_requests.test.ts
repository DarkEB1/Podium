import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(__dirname, '20260728000200_verification_requests.sql'),
  'utf8',
).toLowerCase()

describe('verification_requests migration', () => {
  it('creates the table re-runnably', () => {
    expect(sql).toContain('create table if not exists public.verification_requests')
  })

  it('has a status enum with the three states', () => {
    expect(sql).toContain("create type public.verification_request_status as enum ('pending', 'approved', 'rejected')")
  })

  it('enforces at most one pending request per user', () => {
    expect(sql).toMatch(
      /create unique index[\s\S]*on public\.verification_requests \(user_id\)[\s\S]*where status = 'pending'/,
    )
  })

  it('enables RLS with own-select, own-insert and admin-update policies', () => {
    expect(sql).toContain('alter table public.verification_requests enable row level security')
    expect(sql).toMatch(/verification_requests_select_own[\s\S]*user_id = auth\.uid\(\) or public\.is_admin\(\)/)
    expect(sql).toMatch(/verification_requests_insert_own[\s\S]*with check \(user_id = auth\.uid\(\)\)/)
    expect(sql).toMatch(/verification_requests_admin_update[\s\S]*public\.is_admin\(\)/)
  })
})
