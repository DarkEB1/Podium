import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '20260728000500_social_connections.sql'), 'utf8').toLowerCase()

describe('social_connections migration', () => {
  it('creates the table with one row per (user, provider)', () => {
    expect(sql).toContain('create table if not exists public.social_connections')
    expect(sql).toContain('unique (user_id, provider)')
  })

  it('has token columns (stored encrypted by the app)', () => {
    expect(sql).toContain('access_token')
    expect(sql).toContain('refresh_token')
  })

  it('enables RLS with own select/delete and no user write of tokens', () => {
    expect(sql).toContain('alter table public.social_connections enable row level security')
    expect(sql).toMatch(/social_connections_select_own[\s\S]*user_id = auth\.uid\(\)/)
    expect(sql).toMatch(/social_connections_delete_own[\s\S]*user_id = auth\.uid\(\)/)
    expect(sql).not.toMatch(/for insert|for update/)
  })
})
