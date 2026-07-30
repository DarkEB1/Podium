import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// QA-1.5 — no user had a profile_settings row, so every transactional email
// threw while checking preferences. Static assertions on the migration SQL.

const sql = readFileSync(
  join(__dirname, '20260730000300_profile_settings_bootstrap.sql'),
  'utf8',
).toLowerCase()

describe('QA-1.5 profile_settings bootstrap migration', () => {
  it('creates the settings row for every new user, re-runnably', () => {
    expect(sql).toContain('create or replace function public.handle_new_user_settings()')
    expect(sql).toContain('drop trigger if exists on_user_created_settings on public.users')
    expect(sql).toMatch(
      /create trigger on_user_created_settings\s+after insert on public\.users/,
    )
  })

  it('runs as security definer, since the row is written for the user not by them', () => {
    expect(sql).toMatch(/security definer set search_path = public/)
  })

  it('inserts defaults only and tolerates a row that already exists', () => {
    expect(sql).toMatch(/insert into public\.profile_settings \(user_id\)\s+values \(new\.id\)/)
    expect(sql).toContain('on conflict (user_id) do nothing')
  })

  it('backfills existing accounts, which is all of them', () => {
    expect(sql).toMatch(
      /insert into public\.profile_settings \(user_id\)\s+select u\.id[\s\S]*left join public\.profile_settings/,
    )
    expect(sql).toContain('where ps.user_id is null')
  })

  it('invents no preferences: no column but user_id is written', () => {
    expect(sql).not.toMatch(/notification_matrix\s*=/)
    expect(sql).not.toMatch(/marketing_opt_in\s*=/)
  })
})
