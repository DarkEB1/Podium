import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// WS-ADMIN / reports — duplicate reports flooded the moderation queue. A partial
// unique index allows only one OPEN report per (reporter, target).

const sql = readFileSync(
  join(__dirname, '20260904000903_reports_dedupe.sql'),
  'utf8',
).toLowerCase()

describe('reports dedupe migration', () => {
  it('adds a partial unique index for user targets', () => {
    expect(sql).toContain('reports_one_open_per_user_target')
    expect(sql).toContain('(reporter_id, reported_user_id)')
  })

  it('adds a partial unique index for message targets', () => {
    expect(sql).toContain('reports_one_open_per_message_target')
    expect(sql).toContain('(reporter_id, reported_message_id)')
  })

  it('only constrains still-open reports (pending / under_review)', () => {
    expect(sql).toContain("status in ('pending', 'under_review')")
  })

  it('is idempotent', () => {
    expect(sql).toContain('create unique index if not exists')
  })
})
