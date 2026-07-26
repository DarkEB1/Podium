import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-6 — erase_user_data() had no internal authorisation, aborted for any user
// who had ever been reported (reports_must_have_target), missed storage objects
// uploaded via signed URLs, missed invited-but-unlinked team_admins, ignored
// stripe_webhook_events.payload, and left deletion_requested_at set.
//
// Text assertions. Whether the erasure now runs to completion for a reported
// user can only be verified against a live database.

const sql = readFileSync(
  join(__dirname, '20260720005003_gdpr_erasure_hardening.sql'),
  'utf8'
).toLowerCase()

describe('SEC-6 gdpr erasure hardening migration', () => {
  it('refuses unauthorised JWT callers from inside the function', () => {
    expect(sql).toContain("errcode = 'pd011'")
    expect(sql).toContain('public.is_admin()')
    expect(sql).toContain("'request.jwt.claims'")
  })

  it('re-targets or removes message-only reports BEFORE deleting messages', () => {
    const reportFix = sql.indexOf('update public.reports r')
    const messageDelete = sql.indexOf('delete from public.messages')
    expect(reportFix).toBeGreaterThan(-1)
    expect(reportFix).toBeLessThan(messageDelete)
  })

  it('deletes storage objects by path prefix as well as the deprecated owner column', () => {
    expect(sql).toContain('(storage.foldername(name))[1] = $1::text')
  })

  it('deletes invited-but-unlinked team_admins by email', () => {
    expect(sql).toMatch(/lower\(invited_email\) = lower\(v_email\)/)
  })

  it('anonymises stripe webhook payloads rather than deleting the row', () => {
    expect(sql).toContain('update public.stripe_webhook_events')
    expect(sql).toContain('set payload = null')
    expect(sql).not.toContain('delete from public.stripe_webhook_events')
  })

  it('clears deletion_requested_at on the tombstone', () => {
    expect(sql).toContain('deletion_requested_at    = null')
  })
})
