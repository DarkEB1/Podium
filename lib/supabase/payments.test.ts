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
  getBrandProfileIdForUser,
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  listStaleSubscriptions,
  ACTIVE_SUBSCRIPTION_STATUSES,
  getPaymentByIntentId,
  getWebhookEvent,
  claimWebhookEvent,
  markWebhookEvent,
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
  const rpcQueue: Array<{ data: unknown; error: unknown }> = []

  const mockSingle = vi.fn().mockImplementation(() => {
    const r = singleQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

  const mockRpc = vi.fn().mockImplementation(() => {
    const r = rpcQueue.shift() ?? { data: null, error: null }
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
    in: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: mockSingle,
    maybeSingle: mockSingle,
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
  chain.in.mockReturnValue(chain)
  chain.lt.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom, rpc: mockRpc } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
    mockRpc,
    queueRpc(data: unknown, error: unknown = null) {
      rpcQueue.push({ data, error })
    },
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

// ---------------------------------------------------------------------------
// getBrandProfileIdForUser (B-2)
// ---------------------------------------------------------------------------

describe('getBrandProfileIdForUser', () => {
  it('returns brand_profiles.id for the auth user', async () => {
    const mock = makeMockClient()
    mock.setSingle({ id: 'brand-1' })

    const result = await getBrandProfileIdForUser(mock.client, 'user-brand')

    expect(result).toBe('brand-1')
    expect(mock.mockFrom).toHaveBeenCalledWith('brand_profiles')
    expect(mock.chain.eq).toHaveBeenCalledWith('user_id', 'user-brand')
  })

  it('returns null when the user has no brand profile', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(getBrandProfileIdForUser(mock.client, 'user-x')).resolves.toBeNull()
  })

  it('throws on an unexpected error', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '500', message: 'boom' })

    await expect(getBrandProfileIdForUser(mock.client, 'user-x')).rejects.toMatchObject({
      code: 'BRAND_PROFILE_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getSubscriptionByStripeCustomerId
// ---------------------------------------------------------------------------

describe('getSubscriptionByStripeCustomerId', () => {
  it('returns the subscription linked to a Stripe customer', async () => {
    const mock = makeMockClient()
    mock.setSingle(SUBSCRIPTION)

    const result = await getSubscriptionByStripeCustomerId(mock.client, 'cus_abc')

    expect(result?.brand_id).toBe('brand-1')
    expect(mock.chain.eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_abc')
  })

  it('returns null when the customer is not linked yet', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(getSubscriptionByStripeCustomerId(mock.client, 'cus_new')).resolves.toBeNull()
  })

  // Regression (D2): two rows sharing a customer id used to make `.single()`
  // raise a non-PGRST116 error, which classified as transient and produced an
  // endless 500 retry loop on every subsequent webhook.
  it('resolves deterministically instead of erroring when several rows match', async () => {
    const mock = makeMockClient()
    mock.setSingle(SUBSCRIPTION)

    const result = await getSubscriptionByStripeCustomerId(mock.client, 'cus_abc')

    expect(result?.brand_id).toBe('brand-1')
    expect(mock.chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(mock.chain.limit).toHaveBeenCalledWith(1)
  })

  it('returns null without querying for a blank customer id', async () => {
    const mock = makeMockClient()

    await expect(getSubscriptionByStripeCustomerId(mock.client, '  ')).resolves.toBeNull()
    expect(mock.mockFrom).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// getPaymentByIntentId
// ---------------------------------------------------------------------------

describe('getPaymentByIntentId', () => {
  it('returns the payment row for a payment intent', async () => {
    const mock = makeMockClient()
    mock.setSingle(PAYMENT)

    const result = await getPaymentByIntentId(mock.client, 'pi_abc')

    expect(result?.id).toBe('pay-1')
    expect(mock.chain.eq).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_abc')
  })

  it('returns null when no row exists', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(getPaymentByIntentId(mock.client, 'pi_missing')).resolves.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Stripe webhook event log
// ---------------------------------------------------------------------------

describe('stripe webhook event log', () => {
  const EVENT_ROW = {
    id: 'evt_1',
    type: 'customer.subscription.created',
    received_at: '2026-07-20T00:00:00Z',
    processed_at: null,
    status: 'received' as const,
    error: null,
    payload: {},
  }

  it('getWebhookEvent returns the row', async () => {
    const mock = makeMockClient()
    mock.setSingle(EVENT_ROW)

    const result = await getWebhookEvent(mock.client, 'evt_1')

    expect(result?.status).toBe('received')
    expect(mock.mockFrom).toHaveBeenCalledWith('stripe_webhook_events')
  })

  it('getWebhookEvent returns null for an unseen event', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(getWebhookEvent(mock.client, 'evt_new')).resolves.toBeNull()
  })

  // D3(a): claiming is one atomic RPC, not a read followed by an upsert.
  it('claimWebhookEvent claims through the atomic RPC', async () => {
    const mock = makeMockClient()
    mock.queueRpc([{ did_claim: true, attempt_count: 1, event_status: 'received' }])

    const claim = await claimWebhookEvent(mock.client, {
      id: 'evt_1',
      type: 'charge.succeeded',
      payload: { a: 1 },
    })

    expect(mock.mockRpc).toHaveBeenCalledWith('claim_stripe_webhook_event', {
      p_id: 'evt_1',
      p_type: 'charge.succeeded',
      p_payload: { a: 1 },
    })
    expect(claim).toEqual({ claimed: true, attempts: 1, status: 'received' })
  })

  it('claimWebhookEvent reports a lost claim without throwing', async () => {
    const mock = makeMockClient()
    mock.queueRpc([{ did_claim: false, attempt_count: 3, event_status: 'processed' }])

    const claim = await claimWebhookEvent(mock.client, { id: 'evt_1', type: 'x', payload: {} })

    expect(claim.claimed).toBe(false)
    expect(claim.attempts).toBe(3)
    expect(claim.status).toBe('processed')
  })

  it('claimWebhookEvent throws on a database failure so the caller can return 500', async () => {
    const mock = makeMockClient()
    mock.queueRpc(null, { code: '500', message: 'connection refused' })

    await expect(
      claimWebhookEvent(mock.client, { id: 'evt_1', type: 'x', payload: {} })
    ).rejects.toMatchObject({ code: 'WEBHOOK_EVENT_CLAIM_FAILED' })
  })

  it('markWebhookEvent records status, error and processed_at', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null)

    await markWebhookEvent(mock.client, 'evt_1', 'unprocessable', 'missing brand id')

    expect(mock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unprocessable', error: 'missing brand id' })
    )
    expect(mock.chain.eq).toHaveBeenCalledWith('id', 'evt_1')
  })

  it('markWebhookEvent nulls the error when none is given', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null)

    await markWebhookEvent(mock.client, 'evt_1', 'processed')

    expect(mock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed', error: null })
    )
  })
})

// ---------------------------------------------------------------------------
// Reconciliation support (ST-3 / ST-4 / ST-6)
// ---------------------------------------------------------------------------

describe('getSubscriptionByStripeSubscriptionId', () => {
  it('looks the row up by stripe_subscription_id', async () => {
    const mock = makeMockClient()
    mock.setSingle(SUBSCRIPTION)

    const row = await getSubscriptionByStripeSubscriptionId(mock.client, 'sub_abc')

    expect(mock.mockFrom).toHaveBeenCalledWith('subscriptions')
    expect(mock.chain.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_abc')
    expect(row).toEqual(SUBSCRIPTION)
  })

  it('returns null without querying for a blank id', async () => {
    const mock = makeMockClient()
    const row = await getSubscriptionByStripeSubscriptionId(mock.client, '   ')
    expect(row).toBeNull()
    expect(mock.mockFrom).not.toHaveBeenCalled()
  })

  it('returns null when no row is linked', async () => {
    const mock = makeMockClient()
    mock.setSingle(null)
    expect(await getSubscriptionByStripeSubscriptionId(mock.client, 'sub_zzz')).toBeNull()
  })

  it('throws a PaymentsError on a real database failure', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: '08006', message: 'connection failure' })
    await expect(
      getSubscriptionByStripeSubscriptionId(mock.client, 'sub_abc')
    ).rejects.toBeInstanceOf(PaymentsError)
  })
})

describe('listStaleSubscriptions', () => {
  it('filters to access-granting statuses whose period already ended, oldest first', async () => {
    const mock = makeMockClient()
    mock.setChainResult([SUBSCRIPTION])

    const rows = await listStaleSubscriptions(mock.client, {
      before: '2026-07-20T00:00:00.000Z',
      limit: 25,
    })

    expect(mock.chain.in).toHaveBeenCalledWith('status', [...ACTIVE_SUBSCRIPTION_STATUSES])
    expect(mock.chain.lt).toHaveBeenCalledWith('current_period_end', '2026-07-20T00:00:00.000Z')
    expect(mock.chain.order).toHaveBeenCalledWith('current_period_end', { ascending: true })
    expect(mock.chain.limit).toHaveBeenCalledWith(25)
    expect(rows).toEqual([SUBSCRIPTION])
  })

  it('never includes canceled subscriptions', () => {
    expect(ACTIVE_SUBSCRIPTION_STATUSES).not.toContain('canceled')
  })

  it('returns an empty array when nothing is stale', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null)
    expect(
      await listStaleSubscriptions(mock.client, { before: 'x', limit: 1 })
    ).toEqual([])
  })

  it('throws a PaymentsError when the query fails', async () => {
    const mock = makeMockClient()
    mock.setChainResult(null, { message: 'boom' })
    await expect(
      listStaleSubscriptions(mock.client, { before: 'x', limit: 1 })
    ).rejects.toBeInstanceOf(PaymentsError)
  })
})
