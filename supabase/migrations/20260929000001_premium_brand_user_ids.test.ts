import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(join(__dirname, '20260929000001_premium_brand_user_ids.sql'), 'utf8')

describe('20260929000001_premium_brand_user_ids', () => {
  it('defines a security definer set-returning function over the given ids', () => {
    expect(sql).toMatch(/create or replace function public\.premium_brand_user_ids\(p_user_ids uuid\[\]\)/)
    expect(sql).toMatch(/returns setof uuid/)
    expect(sql).toMatch(/security definer/)
    expect(sql).toMatch(/set search_path = public/)
    expect(sql).toMatch(/bp\.user_id = any \(p_user_ids\)/)
  })

  it('only counts active or trialing top-tier subscriptions', () => {
    expect(sql).toMatch(/s\.tier >= 3/)
    expect(sql).toMatch(/s\.status in \('active', 'trialing'\)/)
  })

  it('locks execution down to authenticated and service_role', () => {
    expect(sql).toMatch(/revoke all on function public\.premium_brand_user_ids\(uuid\[\]\) from public/)
    expect(sql).toMatch(/grant execute on function public\.premium_brand_user_ids\(uuid\[\]\) to authenticated, service_role/)
  })

  it('never returns billing detail, only user ids', () => {
    expect(sql).toMatch(/select distinct bp\.user_id\s+from public\.subscriptions s/)
    expect(sql).not.toMatch(/stripe_/)
  })
})
