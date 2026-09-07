import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-MSG-03 — chat-window subscribes to postgres_changes on public.messages, but
// no migration ever added messages to the supabase_realtime publication, so no
// change events were emitted and recipients only saw new messages on reload.

const sql = readFileSync(
  join(__dirname, '20260904000301_messages_realtime_publication.sql'),
  'utf8',
).toLowerCase()

describe('messages realtime publication migration', () => {
  it('adds public.messages to the supabase_realtime publication', () => {
    expect(sql).toContain('alter publication supabase_realtime add table public.messages')
  })

  it('is idempotent: a re-add (duplicate_object) does not abort the migration', () => {
    expect(sql).toContain('when duplicate_object then')
  })

  it('tolerates a database with no supabase_realtime publication (undefined_object)', () => {
    expect(sql).toContain('when undefined_object then')
  })
})
