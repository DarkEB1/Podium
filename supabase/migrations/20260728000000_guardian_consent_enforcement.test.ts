import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 2.3 — the under-18 guardian-consent gate must live at the DB layer, not only
// in lib/supabase/deals.ts, because signContract writes through the service-role
// client and RLS does not fire on that path. These are static assertions on the
// migration SQL (the suite does not run against a live Postgres).

const sql = readFileSync(
  join(__dirname, '20260728000000_guardian_consent_enforcement.sql'),
  'utf8',
).toLowerCase()

describe('2.3 guardian_consent_enforcement migration', () => {
  describe('consent-token table', () => {
    it('creates guardian_consent_tokens re-runnably', () => {
      expect(sql).toContain('create table if not exists public.guardian_consent_tokens')
    })

    it('stores only a token hash, never the raw token', () => {
      expect(sql).toContain('token_hash')
      expect(sql).not.toMatch(/\btoken_plain\b|\braw_token\b/)
    })

    it('ties a token to an athlete and cascades on athlete deletion', () => {
      expect(sql).toMatch(
        /athlete_user_id\s+uuid\s+not null\s+references public\.athlete_profiles\(user_id\) on delete cascade/,
      )
    })

    it('carries an expiry and a consumed marker', () => {
      expect(sql).toMatch(/expires_at\s+timestamptz\s+not null/)
      expect(sql).toContain('consumed_at')
    })

    it('indexes the token hash for lookup', () => {
      expect(sql).toContain('on public.guardian_consent_tokens (token_hash)')
    })

    it('enables RLS with no policy (service-role only)', () => {
      expect(sql).toContain(
        'alter table public.guardian_consent_tokens enable row level security',
      )
      // No grant to anon/authenticated: there must be no create policy on the table.
      expect(sql).not.toMatch(/create policy[\s\S]*on public\.guardian_consent_tokens/)
    })
  })

  describe('enforcement trigger', () => {
    it('defines the enforcement function re-runnably', () => {
      expect(sql).toContain(
        'create or replace function public.enforce_guardian_consent_on_sign()',
      )
    })

    it('only fires when the athlete signature transitions null -> not null', () => {
      expect(sql).toMatch(
        /new\.athlete_signed_at is not null and old\.athlete_signed_at is null/,
      )
    })

    it('gates on the under-18 flag and a missing guardian acceptance', () => {
      expect(sql).toContain('is_under_18')
      // reads guardian_accepted_at into v_accepted_at, then blocks when it is null
      expect(sql).toContain('ap.guardian_accepted_at')
      expect(sql).toContain('v_accepted_at is null')
    })

    it('raises GUARDIAN_CONSENT_REQUIRED', () => {
      expect(sql).toContain('guardian_consent_required')
    })

    it('lets teams and adults through (guards on found + under-18)', () => {
      expect(sql).toMatch(/if found and v_is_under_18 and v_accepted_at is null then/)
    })

    it('attaches a BEFORE UPDATE trigger on contracts, re-runnably', () => {
      expect(sql).toContain(
        'drop trigger if exists contracts_enforce_guardian_consent on public.contracts',
      )
      expect(sql).toMatch(
        /create trigger contracts_enforce_guardian_consent\s+before update on public\.contracts/,
      )
    })
  })
})
