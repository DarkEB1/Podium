import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '20260728000300_push_subscriptions.sql'), 'utf8').toLowerCase()

describe('push_subscriptions migration', () => {
  it('creates the table re-runnably with a unique endpoint', () => {
    expect(sql).toContain('create table if not exists public.push_subscriptions')
    expect(sql).toMatch(/endpoint\s+text\s+not null\s+unique/)
  })

  it('stores only the client public key material', () => {
    expect(sql).toContain('p256dh')
    expect(sql).toContain('auth')
  })

  it('enables RLS with own select/insert/delete policies', () => {
    expect(sql).toContain('alter table public.push_subscriptions enable row level security')
    expect(sql).toMatch(/push_subscriptions_select_own[\s\S]*user_id = auth\.uid\(\)/)
    expect(sql).toMatch(/push_subscriptions_insert_own[\s\S]*with check \(user_id = auth\.uid\(\)\)/)
    expect(sql).toMatch(/push_subscriptions_delete_own[\s\S]*user_id = auth\.uid\(\)/)
  })
})
