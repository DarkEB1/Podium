import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-MSG-05 — `blocks` rows were written but never read by RLS, so Block was a
// no-op: a blocked user could still message and still send connection requests.
// These are static assertions on the migration SQL (no live Postgres here).

const sql = readFileSync(
  join(__dirname, '20260904000201_message_blocking_enforcement.sql'),
  'utf8',
).toLowerCase()

describe('WS-MSG-05 message blocking enforcement migration', () => {
  it('adds SECURITY DEFINER block-lookup helpers', () => {
    expect(sql).toContain('create or replace function public.is_blocked_between(p_user_a uuid, p_user_b uuid)')
    expect(sql).toContain('create or replace function public.match_has_block(p_match_id uuid)')
    // Both must be definer so the blocked party's own RLS on blocks does not hide the row.
    expect(sql).toMatch(/is_blocked_between[\s\S]*?security definer/)
    expect(sql).toMatch(/match_has_block[\s\S]*?security definer/)
  })

  it('checks a block in BOTH directions (blocker/blocked either way)', () => {
    expect(sql).toContain('b.blocker_id = p_user_a and b.blocked_id = p_user_b')
    expect(sql).toContain('b.blocker_id = p_user_b and b.blocked_id = p_user_a')
    expect(sql).toContain('b.blocker_id = m.user_a_id and b.blocked_id = m.user_b_id')
    expect(sql).toContain('b.blocker_id = m.user_b_id and b.blocked_id = m.user_a_id')
  })

  it('redefines messages_insert to reject when the participants have a block', () => {
    expect(sql).toContain('drop policy if exists "messages_insert" on public.messages')
    expect(sql).toMatch(/create policy "messages_insert"\s*\n\s*on public\.messages for insert/)
    expect(sql).toContain('and not public.match_has_block(match_id)')
    // The pre-existing proposal gate must be preserved, not lost in the rewrite.
    expect(sql).toContain('public.is_match_participant(match_id)')
    expect(sql).toContain("content_type = 'proposal_card'")
    expect(sql).toContain('proposal_sent = true')
  })

  it('redefines connection_requests_insert to reject a blocked pair', () => {
    expect(sql).toContain('drop policy if exists "connection_requests_insert" on public.connection_requests')
    expect(sql).toMatch(
      /create policy "connection_requests_insert"\s*\n\s*on public\.connection_requests for insert/,
    )
    expect(sql).toContain('and not public.is_blocked_between(sender_id, recipient_id)')
    expect(sql).toContain('sender_id = auth.uid()')
  })

  it('keeps the service role able to call the helpers', () => {
    expect(sql).toContain('grant execute on function public.is_blocked_between(uuid, uuid) to authenticated, service_role')
    expect(sql).toContain('grant execute on function public.match_has_block(uuid) to authenticated, service_role')
    expect(sql).toContain('revoke all on function public.is_blocked_between(uuid, uuid) from public')
  })
})
