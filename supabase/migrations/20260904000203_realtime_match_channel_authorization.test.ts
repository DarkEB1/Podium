import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-MSG-08 — the typing / read-receipt / presence channels were public, so
// anyone with the anon key and a match id could subscribe and forge events.
// Private channels authorize against realtime.messages RLS. Static assertions.

const sql = readFileSync(
  join(__dirname, '20260904000203_realtime_match_channel_authorization.sql'),
  'utf8',
).toLowerCase()

describe('WS-MSG-08 realtime match channel authorization migration', () => {
  it('defines a SECURITY DEFINER topic-authorization helper', () => {
    expect(sql).toContain('create or replace function public.can_access_match_channel(p_topic text)')
    expect(sql).toMatch(/can_access_match_channel[\s\S]*?security definer/)
  })

  it('only authorizes the typing and presence topics', () => {
    expect(sql).toContain("v_prefix not in ('typing', 'presence')")
    expect(sql).toContain("split_part(p_topic, ':', 2)")
  })

  it('reuses is_match_participant (scoped to auth.uid()) for the real check', () => {
    expect(sql).toContain('return public.is_match_participant(v_id)')
  })

  it('returns false on a malformed / non-uuid topic instead of raising', () => {
    expect(sql).toContain('exception when others then')
    expect(sql).toContain('return false')
  })

  it('creates read + write policies on realtime.messages using realtime.topic()', () => {
    expect(sql).toContain('"podium_realtime_match_channel_read"')
    expect(sql).toContain('"podium_realtime_match_channel_write"')
    expect(sql).toContain('on realtime.messages for select')
    expect(sql).toContain('on realtime.messages for insert')
    expect(sql).toContain('public.can_access_match_channel((select realtime.topic()))')
    expect(sql).toContain('to authenticated')
  })

  it('guards the realtime DDL so a missing table or privilege error cannot abort the migration', () => {
    expect(sql).toContain("to_regclass('realtime.messages')")
    expect(sql).toContain('when insufficient_privilege then')
    expect(sql).toContain('raise warning')
  })

  it('keeps the service role able to call the helper', () => {
    expect(sql).toContain('grant execute on function public.can_access_match_channel(text) to authenticated, service_role')
  })
})
