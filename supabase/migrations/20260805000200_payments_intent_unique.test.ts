import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ST-7 — duplicate payments rows for one Stripe intent made
// getPaymentByIntentId's .single() raise PGRST116, which is swallowed as
// "no row", so the webhook stranded the settlement.

const sql = readFileSync(
  join(__dirname, '20260805000200_payments_intent_unique.sql'),
  'utf8',
).toLowerCase()

describe('payments intent unique index migration', () => {
  it('creates a unique index on stripe_payment_intent_id', () => {
    expect(sql).toMatch(
      /create unique index if not exists payments_stripe_payment_intent_id_key\s*\n\s*on public\.payments \(stripe_payment_intent_id\)/,
    )
  })

  // The column is nullable and several rows may legitimately have no intent id.
  it('is partial on NOT NULL so null intent ids do not collide', () => {
    expect(sql).toContain('where stripe_payment_intent_id is not null')
  })

  it('is idempotent', () => {
    expect(sql).toContain('if not exists')
  })

  // A unique index cannot be created while duplicates exist.
  it('collapses existing duplicates first, keeping the earliest row', () => {
    expect(sql).toMatch(/delete from public\.payments/)
    expect(sql).toContain('(p.created_at, p.id) > (q.created_at, q.id)')
    expect(sql.indexOf('delete from public.payments')).toBeLessThan(
      sql.indexOf('create unique index'),
    )
  })
})
