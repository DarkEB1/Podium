import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR-8 / SEC-4 — the 300-character connection-request message cap must exist
// at the DB layer, not only in lib/supabase/discovery.ts.

const sql = readFileSync(
  join(__dirname, '20260720001001_connection_request_message_limit.sql'),
  'utf8',
).toLowerCase()

describe('PR-8 connection_request_message_limit migration', () => {
  it('adds a CHECK constraint capping message length at 300', () => {
    expect(sql).toMatch(
      /add constraint connection_requests_message_max_length\s*\n?\s*check \(char_length\(message\) <= 300\)/,
    )
  })

  it('targets the connection_requests table', () => {
    expect(sql).toContain('alter table public.connection_requests')
  })

  it('is re-runnable (drops the constraint if it already exists)', () => {
    expect(sql).toContain('drop constraint if exists connection_requests_message_max_length')
  })

  it('documents the cap on the column', () => {
    expect(sql).toContain('comment on column public.connection_requests.message is')
  })
})
