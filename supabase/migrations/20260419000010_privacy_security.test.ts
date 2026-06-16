import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B4 — Privacy/security migration (plan §1.5 B4, spec §3C.4/7).
// This test asserts the structural contract of the migration SQL: every new
// table exists, carries the agreed columns, and has RLS enabled with a
// scoped policy. We assert against the SQL text (no live DB in unit tests),
// which is the repo's convention for migration verification.

const sql = readFileSync(
  join(__dirname, '20260419000010_privacy_security.sql'),
  'utf8',
).toLowerCase()

function hasCreateTable(name: string): boolean {
  return new RegExp(`create table public\\.${name}\\b`).test(sql)
}

function rlsEnabledFor(name: string): boolean {
  return new RegExp(
    `alter table public\\.${name} enable row level security`,
  ).test(sql)
}

function hasPolicyOn(name: string): boolean {
  return new RegExp(`on public\\.${name} for`).test(sql)
}

const NEW_TABLES = [
  'auth_2fa',
  'active_sessions',
  'login_history',
  'data_export_requests',
]

describe('B4 privacy_security migration', () => {
  it('creates every new table', () => {
    for (const t of NEW_TABLES) {
      expect(hasCreateTable(t), `missing table ${t}`).toBe(true)
    }
  })

  it('enables RLS on every new table (no exceptions)', () => {
    for (const t of NEW_TABLES) {
      expect(rlsEnabledFor(t), `RLS not enabled on ${t}`).toBe(true)
    }
  })

  it('defines at least one access policy on every new table', () => {
    for (const t of NEW_TABLES) {
      expect(hasPolicyOn(t), `no RLS policy on ${t}`).toBe(true)
    }
  })

  it('auth_2fa stores a secret and an enabled flag, keyed to the user', () => {
    expect(/create table public\.auth_2fa[\s\S]*?secret\s+text/.test(sql)).toBe(true)
    expect(/create table public\.auth_2fa[\s\S]*?enabled\s+boolean/.test(sql)).toBe(true)
    expect(/create table public\.auth_2fa[\s\S]*?references public\.users\(id\)/.test(sql)).toBe(true)
  })

  it('active_sessions tracks device/session metadata per user', () => {
    expect(/create table public\.active_sessions[\s\S]*?user_id\s+uuid/.test(sql)).toBe(true)
    expect(/create table public\.active_sessions[\s\S]*?last_active_at\s+timestamptz/.test(sql)).toBe(true)
  })

  it('login_history records auth events per user', () => {
    expect(/create table public\.login_history[\s\S]*?user_id\s+uuid/.test(sql)).toBe(true)
    expect(/create table public\.login_history[\s\S]*?(success|outcome)\s+/.test(sql)).toBe(true)
  })

  it('data_export_requests tracks GDPR export lifecycle', () => {
    expect(/create table public\.data_export_requests[\s\S]*?user_id\s+uuid/.test(sql)).toBe(true)
    expect(/create table public\.data_export_requests[\s\S]*?status\s+/.test(sql)).toBe(true)
    expect(/create table public\.data_export_requests[\s\S]*?expires_at\s+timestamptz/.test(sql)).toBe(true)
  })

  it('adds cookie_prefs jsonb to the users table', () => {
    expect(
      /alter table public\.users[\s\S]*?add column[\s\S]*?cookie_prefs\s+jsonb/.test(sql),
    ).toBe(true)
  })

  it('owns its enums (no cross-pod dependency) for export status', () => {
    expect(/create type public\.data_export_status as enum/.test(sql)).toBe(true)
  })
})
