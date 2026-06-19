import { describe, it, expect, vi } from 'vitest'
import {
  getSubscription,
  getSubscriptionForUser,
  upsertSubscription,
  updateSubscription,
  getPayment,
  getPaymentHistory,
  createPaymentRecord,
  updatePaymentRecord,
  getContractForPayment,
  getBillingHistory,
  listSeats,
  removeSeat,
  PaymentsError,
} from './payments'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock factory — same pattern as deals.test.ts
// ---------------------------------------------------------------------------

function makeMockClient() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const listQueue: Array<{ data: unknown; error: unknown }> = []

  const mockSingle = vi.fn().mockImplementation(() => {
    const r = singleQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    then(
      resolve: (v: unknown) => void,
      reject?: ((reason: unknown) => void) | null
    ): Promise<unknown> {
      const r = listQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.neq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
    },
    queueList(data: unknown, error: unknown = null) {
      listQueue.push({ data, error })
    },
    setSingle(data: unknown, error: unknown = null) {
      singleQueue.length = 0
      singleQueue.push({ data, error })
    },
    setChainResult(data: unknown, error: unknown = null) {
      listQueue.length = 0
      listQueue.push({ data, error })
    },
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBSCRIPTION = {
  id: 'sub-row-1',
  brand_id: 'brand-1',
  stripe_customer_id: 'cus_abc',
  stripe_subscription_id: 'sub_abc',
  tier: 1,
  status: 'active' as const,
  trial_ends_at: null,
  current_period_start: '2026-04-01T00:00:00Z',
  current_period_end: '2026-05-01T00:00:00Z',
  canceled_at: null,
  cancellation_scheduled_at: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
}

const PAYMENT = {
  id: 'pay-1',
  contract_id: 'contract-1',
  payer_id: 'user-brand',
  payee_id: 'user-athlete',
  stripe_payment_intent_id: 'pi_abc',
  amount: 50000,
  currency: 'GBP',
  status: 'pending' as const,
  receipt_url: null,
  stripe_fee: null,
  platform_fee: null,
  net_amount: null,
  processed_at: null,
  tax_disclaimer_shown: false,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// getSubscription
// ---------------------------------------------------------------------------

describe('getSubscription', () => {
  it('returns the subscription for a brand', async () => {
    const mock = makeMockClient()
    mock.setSingle(SUBSCRIPTION)

    const result = await getSubscription(mock.client, 'brand-1')

    expect(result).toEqual(SUBSCRIPTION)
    expect(mock.mockFrom).toHaveBeenCalledWith('subscriptions')
  })

  it('returns null when no subscription exists (PGRST116)', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    const result = await getSubscription(mock.client, 'brand-1')

    expect(result).toBeNull()
  })

  it('throws PaymentsError on unexpected DB error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'DB error' })

    await expect(getSubscription(mock.client, 'brand-1')).rejects.toMatchObject({
      name: 'PaymentsError',
      code: 'SUBSCRIPTION_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getSubscriptionForUser
// ---------------------------------------------------------------------------

describe('getSubscriptionForUser', () => {
  it('returns subscription when brand has one', async () => {
    const mock = makeMockClient()
    mock.setSingle({ id: 'bp-1', subscriptions: [SUBSCRIPTION] })

    const result = await getSubscriptionForUser(mock.client, 'user-1')

    expect(result).toEqual(SUBSCRIPTION)
    expect(mock.mockFrom).toHaveBeenCalledWith('brand_profiles')
  })

  it('returns null when brand has no subscription', async () => {
    const mock = makeMockClient()
    mock.setSingle({ id: 'bp-1', subscriptions: [] })

    const result = await getSubscriptionForUser(mock.client, 'user-1')

    expect(result).toBeNull()
  })

  it('returns null when user has no brand profile (PGRST116)', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    const result = await getSubscriptionForUser(mock.client, 'user-nobody')

    expect(result).toBeNull()
  })

  it('throws PaymentsError on unexpected DB error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'DB error' })

    await expect(getSubscriptionForUser(mock.client, 'user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// upsertSubscription
// ---------------------------------------------------------------------------

describe('upsertSubscription', () => {
  it('returns the upserted subscription row', async () => {
    const mock = makeMockClient()
    mock.setSingle(SUBSCRIPTION)

    const result = await upsertSubscription(mock.client, {
      brand_id: 'brand-1',
      stripe_customer_id: 'cus_abc',
      stripe_subscription_id: 'sub_abc',
      tier: 1,
      status: 'active',
      current_period_start: '2026-04-01T00:00:00Z',
      current_period_end: '2026-05-01T00:00:00Z',
    })

    expect(result).toEqual(SUBSCRIPTION)
    expect(mock.mockFrom).toHaveBeenCalledWith('subscriptions')
  })

  it('throws PaymentsError on upsert failure', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '23505', message: 'unique violation' })

    await expect(
      upsertSubscription(mock.client, {
        brand_id: 'brand-1',
        stripe_customer_id: 'cus_abc',
        stripe_subscription_id: 'sub_abc',
        tier: 1,
        status: 'active',
        current_period_start: '2026-04-01T00:00:00Z',
        current_period_end: '2026-05-01T00:00:00Z',
      })
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_UPSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// updateSubscription
// ---------------------------------------------------------------------------

describe('updateSubscription', () => {
  it('returns the updated subscription row', async () => {
    const updated = { ...SUBSCRIPTION, status: 'canceled' as const }
    const mock = makeMockClient()
    mock.setSingle(updated)

    const result = await updateSubscription(mock.client, 'sub_abc', {
      status: 'canceled',
      canceled_at: '2026-04-20T00:00:00Z',
    })

    expect(result.status).toBe('canceled')
    expect(mock.mockFrom).toHaveBeenCalledWith('subscriptions')
  })

  it('throws PaymentsError when subscription not found', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(
      updateSubscription(mock.client, 'sub_missing', { status: 'canceled' })
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_FOUND' })
  })

  it('throws PaymentsError on unexpected DB error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'DB error' })

    await expect(
      updateSubscription(mock.client, 'sub_abc', { status: 'canceled' })
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_UPDATE_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// getPayment
// ---------------------------------------------------------------------------

describe('getPayment', () => {
  it('returns the payment for a contract', async () => {
    const mock = makeMockClient()
    mock.setSingle(PAYMENT)

    const result = await getPayment(mock.client, 'contract-1')

    expect(result).toEqual(PAYMENT)
    expect(mock.mockFrom).toHaveBeenCalledWith('payments')
  })

  it('returns null when no payment exists (PGRST116)', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    const result = await getPayment(mock.client, 'contract-none')

    expect(result).toBeNull()
  })

  it('throws PaymentsError on unexpected DB error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'DB error' })

    await expect(getPayment(mock.client, 'contract-1')).rejects.toMatchObject({
      code: 'PAYMENT_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getPaymentHistory
// ---------------------------------------------------------------------------

describe('getPaymentHistory', () => {
  it('returns all payments where user is payer or payee', async () => {
    const mock = makeMockClient()
    mock.setChainResult([PAYMENT])

    const result = await getPaymentHistory(mock.client, 'user-brand')

    expect(result).toEqual([PAYMENT])
    expect(mock.mockFrom).toHaveBeenCalledWith('payments')
  })

  it('returns empty array when no payments exist', async () => {
    const mock = makeMockClient()
    mock.setChainResult([])

    const result = await getPaymentHistory(mock.client, 'user-nobody')

    expect(result).toEqual([])
  })

  it('throws PaymentsError on DB error', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null, { code: '500', message: 'DB error' })

    await expect(getPaymentHistory(mock.client, 'user-1')).rejects.toMatchObject({
      code: 'PAYMENT_HISTORY_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// createPaymentRecord
// ---------------------------------------------------------------------------

describe('createPaymentRecord', () => {
  it('inserts and returns the new payment row', async () => {
    const mock = makeMockClient()
    mock.setSingle(PAYMENT)

    const result = await createPaymentRecord(mock.client, {
      contract_id: 'contract-1',
      payer_id: 'user-brand',
      payee_id: 'user-athlete',
      stripe_payment_intent_id: 'pi_abc',
      amount: 50000,
      currency: 'GBP',
    })

    expect(result).toEqual(PAYMENT)
    expect(mock.mockFrom).toHaveBeenCalledWith('payments')
  })

  it('throws PaymentsError on insert failure', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '23503', message: 'fk violation' })

    await expect(
      createPaymentRecord(mock.client, {
        contract_id: 'contract-bad',
        payer_id: 'user-brand',
        payee_id: 'user-athlete',
        stripe_payment_intent_id: 'pi_abc',
        amount: 50000,
        currency: 'GBP',
      })
    ).rejects.toMatchObject({ code: 'PAYMENT_INSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// getContractForPayment
// ---------------------------------------------------------------------------

describe('getContractForPayment', () => {
  it('returns contract with pay_amount from linked proposal', async () => {
    const mock = makeMockClient()
    mock.setSingle({
      id: 'contract-1',
      brand_id: 'brand-1',
      athlete_or_team_id: 'athlete-1',
      proposals: { pay_amount: 50000, pay_currency: 'GBP' },
    })

    const result = await getContractForPayment(mock.client, 'contract-1')

    expect(result).toEqual({
      id: 'contract-1',
      brand_id: 'brand-1',
      athlete_or_team_id: 'athlete-1',
      pay_amount: 50000,
      pay_currency: 'GBP',
    })
    expect(mock.mockFrom).toHaveBeenCalledWith('contracts')
  })

  it('throws CONTRACT_NOT_FOUND for PGRST116', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(getContractForPayment(mock.client, 'contract-missing')).rejects.toMatchObject({
      code: 'CONTRACT_NOT_FOUND',
    })
  })

  it('throws CONTRACT_FETCH_FAILED when proposal is null', async () => {
    const mock = makeMockClient()
    mock.setSingle({
      id: 'contract-1',
      brand_id: 'brand-1',
      athlete_or_team_id: 'athlete-1',
      proposals: null,
    })

    await expect(getContractForPayment(mock.client, 'contract-1')).rejects.toMatchObject({
      code: 'CONTRACT_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// updatePaymentRecord
// ---------------------------------------------------------------------------

describe('updatePaymentRecord', () => {
  it('updates and returns the payment row by stripe_payment_intent_id', async () => {
    const updated = { ...PAYMENT, status: 'succeeded' as const, processed_at: '2026-04-20T10:00:00Z' }
    const mock = makeMockClient()
    mock.setSingle(updated)

    const result = await updatePaymentRecord(mock.client, 'pi_abc', {
      status: 'succeeded',
      processed_at: '2026-04-20T10:00:00Z',
    })

    expect(result.status).toBe('succeeded')
    expect(result.processed_at).toBe('2026-04-20T10:00:00Z')
    expect(mock.mockFrom).toHaveBeenCalledWith('payments')
  })

  it('throws PaymentsError when payment intent not found', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(
      updatePaymentRecord(mock.client, 'pi_missing', { status: 'failed' })
    ).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' })
  })

  it('throws PaymentsError on unexpected DB error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'DB error' })

    await expect(
      updatePaymentRecord(mock.client, 'pi_abc', { status: 'failed' })
    ).rejects.toMatchObject({ code: 'PAYMENT_UPDATE_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// getBillingHistory (B9)
// ---------------------------------------------------------------------------

describe('getBillingHistory', () => {
  it('returns brand invoices newest-first with receipt url', async () => {
    const mock = makeMockClient()
    mock.setChainResult([
      {
        id: 'pay-1',
        amount: 50000,
        currency: 'GBP',
        status: 'succeeded',
        created_at: '2026-04-01T00:00:00Z',
        receipt_url: 'https://stripe/receipt/1',
      },
    ])

    const result = await getBillingHistory(mock.client, 'brand-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.receipt_url).toBe('https://stripe/receipt/1')
    expect(mock.mockFrom).toHaveBeenCalledWith('payments')
    expect(mock.chain.eq).toHaveBeenCalledWith('payer_id', 'brand-1')
  })

  it('throws PaymentsError on DB error', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null, { code: '500', message: 'DB error' })

    await expect(getBillingHistory(mock.client, 'brand-1')).rejects.toMatchObject({
      code: 'BILLING_HISTORY_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// listSeats / removeSeat (B9)
// ---------------------------------------------------------------------------

const SEATED_SUBSCRIPTION = { ...SUBSCRIPTION, seats_total: 5, seats_used: 3 }

describe('listSeats', () => {
  it('returns the subscription seat allocation', async () => {
    const mock = makeMockClient()
    mock.setSingle(SEATED_SUBSCRIPTION)

    const result = await listSeats(mock.client, 'brand-1')

    expect(result).toEqual({ seats_total: 5, seats_used: 3, members: [] })
  })

  it('throws when no subscription exists', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(listSeats(mock.client, 'brand-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_NOT_FOUND',
    })
  })
})

describe('removeSeat', () => {
  it('decrements seats_used and returns the updated subscription', async () => {
    const mock = makeMockClient()
    // First single() resolves getSubscription, second resolves the update.
    mock.queueSingle(SEATED_SUBSCRIPTION)
    mock.queueSingle({ ...SEATED_SUBSCRIPTION, seats_used: 2 })

    const result = await removeSeat(mock.client, 'brand-1')

    expect(result.seats_used).toBe(2)
    expect(mock.chain.update).toHaveBeenCalledWith({ seats_used: 2 })
  })

  it('never goes below zero seats', async () => {
    const mock = makeMockClient()
    mock.queueSingle({ ...SEATED_SUBSCRIPTION, seats_used: 0 })
    mock.queueSingle({ ...SEATED_SUBSCRIPTION, seats_used: 0 })

    await removeSeat(mock.client, 'brand-1')

    expect(mock.chain.update).toHaveBeenCalledWith({ seats_used: 0 })
  })

  it('throws when no subscription exists', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(removeSeat(mock.client, 'brand-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_NOT_FOUND',
    })
  })
})
