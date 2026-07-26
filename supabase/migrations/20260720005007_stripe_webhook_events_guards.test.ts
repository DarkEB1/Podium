import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEC-10 — 20260720002000 is the only new migration with bare `create type` /
// `create table` / `create index`. This convergence migration re-declares the
// same objects idempotently. It cannot make the original re-runnable.

const sql = readFileSync(
  join(__dirname, '20260720005007_stripe_webhook_events_guards.sql'),
  'utf8'
).toLowerCase()

describe('SEC-10 stripe webhook events guard migration', () => {
  it('creates the enum only when it is missing', () => {
    expect(sql).toContain("t.typname = 'stripe_webhook_event_status'")
    expect(sql).toContain('if not exists (')
  })

  it('uses if-not-exists for the table and both indexes', () => {
    expect(sql).toContain('create table if not exists public.stripe_webhook_events')
    expect(sql).toContain('create index if not exists stripe_webhook_events_status_idx')
    expect(sql).toContain('create index if not exists stripe_webhook_events_received_at_idx')
  })

  it('leaves RLS enabled with no policies (service role only)', () => {
    expect(sql).toContain('alter table public.stripe_webhook_events enable row level security')
    expect(sql).not.toContain('create policy')
  })
})
