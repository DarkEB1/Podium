import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B3 (plan §1.5): settings_expansion migration.
// No local Postgres is available in the unit test environment, so we assert the
// migration SQL statically declares the required enums, columns, table, and RLS.
// Spec §3C.2/3/4. Normalise whitespace so formatting changes don't break assertions.
const sql = readFileSync(
  join(__dirname, '20260616000003_settings_expansion.sql'),
  'utf8',
)
  .toLowerCase()
  .replace(/\s+/g, ' ')

describe('B3 settings_expansion migration', () => {
  it('creates the email_digest enum with daily/weekly/off', () => {
    expect(sql).toContain("create type public.email_digest as enum ('daily', 'weekly', 'off')")
  })

  it('creates the location_precision enum with city/region/country', () => {
    expect(sql).toContain(
      "create type public.location_precision as enum ('city', 'region', 'country')",
    )
  })

  it('creates the display_currency enum with gbp/usd/eur', () => {
    expect(sql).toContain("create type public.display_currency as enum ('gbp', 'usd', 'eur')")
  })

  it('creates the profile_settings table keyed on the owning user', () => {
    expect(sql).toContain('create table public.profile_settings')
    expect(sql).toContain(
      'user_id uuid not null unique references public.users(id) on delete cascade',
    )
  })

  it('adds the notification matrix as a jsonb column', () => {
    expect(sql).toMatch(/notification_matrix jsonb not null default '\{\}'/)
  })

  it('adds quiet hours start and end columns', () => {
    expect(sql).toContain('quiet_hours_start time')
    expect(sql).toContain('quiet_hours_end time')
  })

  it('adds email_digest, marketing_opt_in, pause_matches and display_currency columns', () => {
    expect(sql).toContain("email_digest public.email_digest not null default 'off'")
    expect(sql).toContain('marketing_opt_in boolean not null default false')
    expect(sql).toContain('pause_matches boolean not null default false')
    expect(sql).toContain("display_currency public.display_currency not null default 'gbp'")
  })

  it('adds visibility/discovery columns including location_precision', () => {
    expect(sql).toContain('profile_visible boolean not null default true')
    expect(sql).toContain('discoverable boolean not null default true')
    expect(sql).toContain('section_visibility jsonb not null default')
    expect(sql).toContain("location_precision public.location_precision not null default 'city'")
  })

  it('enables RLS and scopes every policy to the owning user', () => {
    expect(sql).toContain('alter table public.profile_settings enable row level security')
    expect(sql).toContain('create policy "profile_settings_select"')
    expect(sql).toContain('create policy "profile_settings_insert"')
    expect(sql).toContain('create policy "profile_settings_update"')
    expect(sql).toContain('using (user_id = auth.uid() or public.is_admin())')
    expect(sql).toContain('with check (user_id = auth.uid())')
  })

  it('attaches the shared updated_at trigger', () => {
    expect(sql).toContain('set_profile_settings_updated_at')
    expect(sql).toContain('execute procedure public.set_updated_at()')
  })
})
