import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guards the SQL contract the Stripe webhook depends on:
//   D1 — an attempt counter exists to cap poison events now that unknown
//        failures default to "retry"
//   D2 — a blank stripe_customer_id can no longer be written
//   D3 — claiming a delivery is one atomic statement

const sql = readFileSync(
  join(__dirname, '20260720006000_stripe_webhook_claim_and_customer_guard.sql'),
  'utf8',
).toLowerCase()

describe('stripe webhook claim + customer guard migration', () => {
  it('adds the attempt counter and claim timestamp idempotently', () => {
    expect(sql).toMatch(/add column if not exists attempts integer not null default 0/)
    expect(sql).toMatch(/add column if not exists claimed_at timestamptz/)
  })

  describe('claim_stripe_webhook_event', () => {
    it('claims in a single insert .. on conflict statement', () => {
      expect(sql).toMatch(/insert into public\.stripe_webhook_events[\s\S]*?on conflict \(id\) do update/)
    })

    it('increments the attempt count on every claim', () => {
      expect(sql).toContain('attempts   = swe.attempts + 1')
    })

    it('always re-claims a failed row, so a Stripe retry is never dropped', () => {
      expect(sql).toMatch(/swe\.status = 'failed'\s*\n?\s*or \(/)
    })

    it('re-claims a received row only once the in-flight claim is stale', () => {
      expect(sql).toMatch(/swe\.status = 'received'[\s\S]*?swe\.claimed_at < v_now - make_interval/)
    })

    it('is SECURITY DEFINER with a pinned search_path and no client access', () => {
      expect(sql).toContain('security definer')
      expect(sql).toContain('set search_path = public, pg_temp')
      expect(sql).toContain(
        'revoke all on function public.claim_stripe_webhook_event(text, text, jsonb, integer) from anon',
      )
      expect(sql).toContain(
        'revoke all on function public.claim_stripe_webhook_event(text, text, jsonb, integer) from authenticated',
      )
    })
  })

  it('forbids blank Stripe ids on subscriptions', () => {
    expect(sql).toContain('check (btrim(stripe_customer_id) <> \'\')')
    expect(sql).toContain('check (btrim(stripe_subscription_id) <> \'\')')
  })

  it('adds the constraints NOT VALID so historical rows cannot fail the deploy', () => {
    expect(sql).toMatch(/subscriptions_stripe_customer_id_not_blank[\s\S]*?not valid/)
    expect(sql).toMatch(/subscriptions_stripe_subscription_id_not_blank[\s\S]*?not valid/)
  })
})
