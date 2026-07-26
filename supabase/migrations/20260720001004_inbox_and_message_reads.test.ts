import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SB-3 / L-3 — the inbox must resolve in ONE query and report a real unread
// count backed by a read-watermark table.

const sql = readFileSync(
  join(__dirname, '20260720001004_inbox_and_message_reads.sql'),
  'utf8',
).toLowerCase()

describe('SB-3/L-3 inbox_and_message_reads migration', () => {
  describe('participant_display view', () => {
    it('unions all four profile tables', () => {
      for (const t of [
        'public.athlete_profiles',
        'public.brand_profiles',
        'public.team_profiles',
        'public.agent_profiles',
      ]) {
        expect(sql, `view does not cover ${t}`).toContain(`from ${t}`)
      }
      // three UNION ALL joins for four SELECTs (plus the header comment)
      expect(sql.match(/union all/g)?.length).toBeGreaterThanOrEqual(3)
    })

    it('is not exposed to client roles', () => {
      expect(sql).toContain('revoke all on public.participant_display from anon, authenticated')
    })
  })

  describe('message_reads table', () => {
    it('is keyed on (match_id, user_id) with a last_read_at watermark', () => {
      expect(sql).toMatch(/create table if not exists public\.message_reads/)
      expect(sql).toMatch(/last_read_at\s+timestamptz not null/)
      expect(sql).toContain('primary key (match_id, user_id)')
    })

    it('has RLS enabled — no exceptions', () => {
      expect(sql).toContain('alter table public.message_reads enable row level security')
    })

    it('scopes every policy to the owning user', () => {
      for (const p of [
        'message_reads_select',
        'message_reads_insert',
        'message_reads_update',
        'message_reads_delete',
      ]) {
        expect(sql, `missing policy ${p}`).toContain(`create policy "${p}"`)
      }
      expect(sql.match(/user_id = auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(5)
    })

    it('only lets a participant create a watermark', () => {
      expect(sql).toMatch(
        /create policy "message_reads_insert"[\s\S]*?public\.is_match_participant\(match_id\)/,
      )
    })
  })

  describe('mark_match_read', () => {
    it('is SECURITY DEFINER, participant-checked and upserts the watermark', () => {
      const body = /create or replace function public\.mark_match_read\([\s\S]*?\n\$\$;/.exec(sql)?.[0] ?? ''
      expect(body).toContain('security definer set search_path = public')
      expect(body).toContain('user_a_id = v_caller or user_b_id = v_caller')
      expect(body).toContain('on conflict (match_id, user_id)')
    })
  })

  describe('get_conversations', () => {
    const body = /create or replace function public\.get_conversations\([\s\S]*?\n\$\$;/.exec(sql)?.[0] ?? ''

    it('returns every field the Conversation view-model needs', () => {
      for (const col of [
        'match_id',
        'other_user_id',
        'display_name',
        'avatar_url',
        'last_message_text',
        'last_message_type',
        'last_message_at',
        'matched_at',
        'unread_count',
      ]) {
        expect(body, `get_conversations does not return ${col}`).toContain(col)
      }
    })

    it('scopes strictly to the caller', () => {
      expect(body).toContain('m.user_a_id = auth.uid() or m.user_b_id = auth.uid()')
      expect(body).toContain('auth.uid() is not null')
    })

    it('only lists active matches', () => {
      expect(body).toContain("m.status = 'active'")
    })

    it('ignores deleted messages for both the preview and the unread count', () => {
      expect(body.match(/is_deleted = false/g)?.length).toBe(2)
    })

    it('counts unread as messages after the watermark from the other party', () => {
      expect(body).toContain('msg.sender_id <> mm.me')
      expect(body).toContain('r.last_read_at')
      expect(body).toContain("'-infinity'::timestamptz")
    })

    it('is executable by authenticated users only', () => {
      expect(sql).toContain('revoke all on function public.get_conversations() from public')
      expect(sql).toContain(
        'grant execute on function public.get_conversations() to authenticated, service_role',
      )
    })
  })

  it('indexes messages for the per-match lookups', () => {
    expect(sql).toMatch(/create index if not exists messages_match_id_sent_at_idx/)
  })
})
