import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// B5 — Payments/financial migration (plan §1.5 B5, spec §3C.5, §4C.1).
// No live DB in CI, so we assert the migration SQL statically: required columns,
// the payment_methods table, brand subscription seat columns, and RLS on the new
// table. Billing history is sourced from Stripe + the existing `payments` table,
// so this migration must NOT create an invoices table.

const sql = readFileSync(
  join(__dirname, '20260419000011_payments_financial.sql'),
  'utf8',
)
const norm = sql.toLowerCase().replace(/\s+/g, ' ')

describe('B5 payments_financial migration', () => {
  it('adds athlete_profiles payout columns (bank + stripe-connect)', () => {
    for (const col of [
      'payout_method',
      'payout_bank_name',
      'payout_account_holder',
      'payout_account_last4',
      'payout_sort_code_last4',
      'payout_country',
      'stripe_connect_account_id',
      'stripe_connect_status',
      'stripe_connect_onboarded_at',
    ]) {
      expect(
        norm.includes(`alter table public.athlete_profiles add column if not exists ${col}`),
        `missing athlete_profiles.${col}`,
      ).toBe(true)
    }
  })

  it('defines a payout_method enum (bank_transfer + stripe_connect)', () => {
    expect(norm).toContain('create type public.payout_method as enum')
    expect(norm).toContain("'bank_transfer'")
    expect(norm).toContain("'stripe_connect'")
  })

  it('creates the payment_methods table with required columns', () => {
    expect(norm).toContain('create table public.payment_methods')
    for (const col of [
      'user_id',
      'stripe_customer_id',
      'stripe_payment_method_id',
      'brand',
      'last4',
      'exp_month',
      'exp_year',
      'is_default',
    ]) {
      expect(norm.includes(` ${col} `), `missing payment_methods.${col}`).toBe(true)
    }
  })

  it('enables RLS and an owner-scoped select policy on payment_methods', () => {
    expect(norm).toContain('alter table public.payment_methods enable row level security')
    expect(norm).toContain('create policy "payment_methods_select"')
    expect(norm).toContain('user_id = auth.uid()')
  })

  it('adds brand subscription seat columns', () => {
    for (const col of ['seats_total', 'seats_used']) {
      expect(
        norm.includes(`alter table public.subscriptions add column if not exists ${col}`),
        `missing subscriptions.${col}`,
      ).toBe(true)
    }
  })

  it('does NOT create an invoices table (billing history comes from Stripe + payments)', () => {
    expect(norm).not.toContain('create table public.invoices')
  })
})
