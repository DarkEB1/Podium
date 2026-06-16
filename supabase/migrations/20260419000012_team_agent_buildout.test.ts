import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B6 — Team/Agent build-out migration. This co-located test asserts the SQL
// migration declares the exact schema objects the §1.4 data layer depends on.
// It treats the migration text as the contract (no live DB in unit context).
const SQL = readFileSync(
  join(__dirname, '20260419000012_team_agent_buildout.sql'),
  'utf8',
)
// Normalise whitespace for forgiving substring assertions.
const sql = SQL.toLowerCase().replace(/\s+/g, ' ')

describe('B6 team_agent_buildout migration', () => {
  describe('team_profiles columns', () => {
    it('adds media_pack_url (idempotent)', () => {
      expect(sql).toContain(
        'alter table public.team_profiles add column if not exists media_pack_url text',
      )
    })

    it('adds annual_sponsorship_target (idempotent)', () => {
      expect(sql).toContain(
        'alter table public.team_profiles add column if not exists annual_sponsorship_target numeric',
      )
    })

    it('ensures fan_reach exists (idempotent, already present in base schema)', () => {
      expect(sql).toContain(
        'alter table public.team_profiles add column if not exists fan_reach public.fan_reach',
      )
    })
  })

  describe('agent_profiles columns + verification enum', () => {
    it('creates agent_verification_status enum with the three states', () => {
      expect(sql).toContain('create type public.agent_verification_status as enum')
      expect(sql).toContain("'unverified'")
      expect(sql).toContain("'pending'")
      expect(sql).toContain("'verified'")
    })

    it('adds verification_status column defaulting to unverified', () => {
      expect(sql).toContain(
        'add column if not exists verification_status public.agent_verification_status not null default',
      )
    })

    it('adds numeric commission_rate column if missing', () => {
      expect(sql).toContain(
        'alter table public.agent_profiles add column if not exists commission_rate numeric',
      )
    })
  })

  describe('team_admins table', () => {
    it('creates the team_admin_role enum (Primary/Standard/ViewOnly)', () => {
      expect(sql).toContain('create type public.team_admin_role as enum')
      expect(sql).toContain("'primary'")
      expect(sql).toContain("'standard'")
      expect(sql).toContain("'view_only'")
    })

    it('creates the team_admin_invite_status enum', () => {
      expect(sql).toContain('create type public.team_admin_invite_status as enum')
      expect(sql).toContain("'invited'")
      expect(sql).toContain("'accepted'")
    })

    it('creates the team_admins table referencing team_profiles', () => {
      expect(sql).toContain('create table if not exists public.team_admins')
      expect(sql).toContain(
        'team_id uuid not null references public.team_profiles(id) on delete cascade',
      )
      expect(sql).toContain('role public.team_admin_role not null')
      expect(sql).toContain('invite_status public.team_admin_invite_status not null')
    })

    it('enables row level security on team_admins', () => {
      expect(sql).toContain(
        'alter table public.team_admins enable row level security',
      )
    })

    it('defines select/insert/update/delete RLS policies on team_admins', () => {
      expect(sql).toContain('create policy "team_admins_select"')
      expect(sql).toContain('create policy "team_admins_insert"')
      expect(sql).toContain('create policy "team_admins_update"')
      expect(sql).toContain('create policy "team_admins_delete"')
      expect(sql).toContain('on public.team_admins')
    })

    it('updated_at is maintained by the shared trigger', () => {
      expect(sql).toContain('before update on public.team_admins')
      expect(sql).toContain('public.set_updated_at()')
    })
  })
})
