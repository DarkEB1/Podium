import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Text assertions only — no database is reachable from the test suite. Whether
// the constraints actually validate depends entirely on live data.

const sql = readFileSync(
  join(__dirname, '20260720008001_validate_subscription_stripe_id_checks.sql'),
  'utf8'
).toLowerCase()

describe('subscriptions blank-Stripe-id constraint validation migration', () => {
  it('validates both constraints left NOT VALID by 20260720006000', () => {
    expect(sql).toContain('subscriptions_stripe_customer_id_not_blank')
    expect(sql).toContain('subscriptions_stripe_subscription_id_not_blank')
    expect(sql).toContain('validate constraint')
  })

  it('cannot fail the deploy on historical data', () => {
    // A bare `alter table ... validate constraint` would abort the migration if
    // any legacy row holds a blank id. The handler downgrades that to a warning.
    expect(sql).toContain('exception when check_violation')
    expect(sql).toContain('raise warning')
  })

  it('tolerates an environment that predates the constraints', () => {
    expect(sql).toContain('from pg_constraint')
    expect(sql).toContain('continue')
  })

  it('adds no new constraint and mutates no data', () => {
    expect(sql).not.toContain('add constraint')
    expect(sql).not.toMatch(/\bdelete\s+from\b/)
    expect(sql).not.toMatch(/\bupdate\s+public\./)
    expect(sql).not.toMatch(/\bdrop\s+constraint\b/)
  })

  it('only touches public.subscriptions', () => {
    const tables = sql.match(/alter table public\.(\w+)/g) ?? []
    expect(tables.length).toBeGreaterThan(0)
    expect(tables.every((t) => t.endsWith('subscriptions'))).toBe(true)
  })
})
