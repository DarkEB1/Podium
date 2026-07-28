import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 2.5 — the three missing scheduled jobs. Static assertions on the migration
// SQL (the suite does not run against a live Postgres).

const sql = readFileSync(
  join(__dirname, '20260728000100_prelaunch_cron_jobs.sql'),
  'utf8',
).toLowerCase()

describe('2.5 prelaunch cron jobs migration', () => {
  describe('chat auto-clear (Flow 43)', () => {
    it('defines clear_expired_chat_messages as a security-definer function', () => {
      expect(sql).toContain('create or replace function public.clear_expired_chat_messages()')
      expect(sql).toMatch(/clear_expired_chat_messages\(\)[\s\S]*security definer/)
    })

    it('keys the retention window on athlete_profiles.chat_retention_days', () => {
      expect(sql).toContain('chat_retention_days')
    })

    it('keeps messages indefinitely when retention is null or non-positive', () => {
      expect(sql).toContain('ap.chat_retention_days is not null')
      expect(sql).toContain('ap.chat_retention_days > 0')
    })

    it('deletes only messages older than the window', () => {
      expect(sql).toMatch(/delete from public\.messages/)
      expect(sql).toContain('make_interval(days => ap.chat_retention_days)')
    })
  })

  describe('guardian-consent-expiry purge (Flow 18)', () => {
    it('defines purge_expired_guardian_consent_tokens', () => {
      expect(sql).toContain(
        'create or replace function public.purge_expired_guardian_consent_tokens()',
      )
    })

    it('purges consumed or expired tokens', () => {
      expect(sql).toContain('consumed_at is not null')
      expect(sql).toContain('expires_at < now()')
      expect(sql).toMatch(/delete from public\.guardian_consent_tokens/)
    })
  })

  describe('18th-birthday control transfer (Flow 18)', () => {
    it('defines transfer_control_for_new_adults', () => {
      expect(sql).toContain('create or replace function public.transfer_control_for_new_adults()')
    })

    it('clears is_under_18 only for athletes who have reached 18', () => {
      expect(sql).toContain('set is_under_18 = false')
      expect(sql).toContain('is_under_18 = true')
      expect(sql).toContain("date_of_birth <= current_date - interval '18 years'")
    })

    it('never re-flags a minor (only sets the flag to false)', () => {
      expect(sql).not.toMatch(/set is_under_18 = true/)
    })
  })

  it('all three functions return a row count', () => {
    expect(sql.match(/get diagnostics/g)?.length).toBe(3)
  })
})
