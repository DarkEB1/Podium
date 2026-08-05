import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before vi.mock() factory runs
// ---------------------------------------------------------------------------

const mockCheckoutCreate = vi.hoisted(() => vi.fn())
const mockPaymentIntentsCreate = vi.hoisted(() => vi.fn())
const mockSubscriptionsUpdate = vi.hoisted(() => vi.fn())
const mockSubscriptionsRetrieve = vi.hoisted(() => vi.fn())
const mockSubscriptionsList = vi.hoisted(() => vi.fn())
const mockChargesRetrieve = vi.hoisted(() => vi.fn())
const mockWebhooksConstructEvent = vi.hoisted(() => vi.fn())

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCheckoutCreate } },
    paymentIntents: { create: mockPaymentIntentsCreate },
    subscriptions: {
      update: mockSubscriptionsUpdate,
      retrieve: mockSubscriptionsRetrieve,
      list: mockSubscriptionsList,
    },
    charges: { retrieve: mockChargesRetrieve },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  })),
}))

// Import after mocking
import {
  createCheckoutSession,
  createPaymentIntent,
  toMinorUnits,
  cancelSubscription,
  constructWebhookEvent,
  retrieveSubscription,
  retrieveChargeSettlement,
  listSubscriptionsPage,
  retrieveSubscriptionSnapshot,
  toSubscriptionSnapshot,
  mapStripeSubscriptionStatus,
  isStripeResourceMissing,
  STRIPE_LIST_MAX_PAGE_SIZE,
  buildSubscriptionMetadata,
  buildPaymentMetadata,
  parseSubscriptionMetadata,
  parsePaymentMetadata,
  STRIPE_API_VERSION,
} from './index'
import { resetEnvCache } from '@/lib/env'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BRAND_PROFILE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CONTRACT_ID = '33333333-3333-4333-8333-333333333333'
const PAYER_ID = '44444444-4444-4444-8444-444444444444'
const PAYEE_ID = '55555555-5555-4555-8555-555555555555'

const SESSION = {
  id: 'cs_test_abc',
  url: 'https://checkout.stripe.com/pay/cs_test_abc',
}

const PAYMENT_INTENT = {
  id: 'pi_test_abc',
  client_secret: 'pi_test_abc_secret_xyz',
  amount: 50000,
  currency: 'gbp',
}

function setEnv() {
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_123'
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  process.env['STRIPE_PRICE_TIER_1'] = 'price_tier1'
  process.env['STRIPE_PRICE_TIER_2'] = 'price_tier2'
  process.env['STRIPE_PRICE_TIER_3'] = 'price_tier3'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key'
  resetEnvCache()
}

const baseCheckoutParams = {
  brandProfileId: BRAND_PROFILE_ID,
  userId: USER_ID,
  successUrl: 'https://app.test/success',
  cancelUrl: 'https://app.test/cancel',
}

// ---------------------------------------------------------------------------
// Metadata contract
// ---------------------------------------------------------------------------

describe('subscription metadata contract', () => {
  it('round-trips through build → parse', () => {
    const built = buildSubscriptionMetadata({ brandProfileId: BRAND_PROFILE_ID, userId: USER_ID })
    expect(built).toEqual({ brandProfileId: BRAND_PROFILE_ID, userId: USER_ID })
    expect(parseSubscriptionMetadata(built)).toEqual({
      brandProfileId: BRAND_PROFILE_ID,
      userId: USER_ID,
    })
  })

  it('returns null for missing metadata rather than throwing', () => {
    expect(parseSubscriptionMetadata(null)).toBeNull()
    expect(parseSubscriptionMetadata(undefined)).toBeNull()
    expect(parseSubscriptionMetadata({})).toBeNull()
  })

  it('returns null when brandProfileId is an empty string (the B-2 defect)', () => {
    expect(parseSubscriptionMetadata({ brandProfileId: '', userId: USER_ID })).toBeNull()
  })

  it('returns null when brandProfileId is not a uuid', () => {
    expect(parseSubscriptionMetadata({ brandProfileId: 'not-a-uuid', userId: USER_ID })).toBeNull()
  })
})

describe('payment metadata contract', () => {
  it('round-trips through build → parse', () => {
    const built = buildPaymentMetadata({
      contractId: CONTRACT_ID,
      payerId: PAYER_ID,
      payeeId: PAYEE_ID,
    })
    expect(built).toEqual({ contractId: CONTRACT_ID, payerId: PAYER_ID, payeeId: PAYEE_ID })
    expect(parsePaymentMetadata(built)).toEqual(built)
  })

  it('returns null when payerId/payeeId are absent (the ST-5 defect)', () => {
    expect(parsePaymentMetadata({ contractId: CONTRACT_ID })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Client construction
// ---------------------------------------------------------------------------

describe('Stripe client', () => {
  it('pins an explicit apiVersion supported by stripe ^17.7.0', () => {
    expect(STRIPE_API_VERSION).toBe('2025-02-24.acacia')
  })
})

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  it('creates a checkout session for tier 1 and returns url and sessionId', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    const result = await createCheckoutSession({ ...baseCheckoutParams, tier: 1 })

    expect(result).toEqual({ url: SESSION.url, sessionId: SESSION.id })
  })

  it('uses the tier price id from validated env', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({ ...baseCheckoutParams, tier: 2 })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    const lineItems = call['line_items'] as Array<Record<string, unknown>>
    expect(lineItems[0]?.['price']).toBe('price_tier2')
  })

  it('passes trial_period_days: 7 in subscription_data', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({ ...baseCheckoutParams, tier: 1 })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect((call['subscription_data'] as Record<string, unknown>)?.['trial_period_days']).toBe(7)
  })

  it('puts the metadata on subscription_data so it lands on the subscription (B-2 root cause)', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({ ...baseCheckoutParams, tier: 1 })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    const subData = call['subscription_data'] as Record<string, unknown>
    expect(subData['metadata']).toEqual({
      brandProfileId: BRAND_PROFILE_ID,
      userId: USER_ID,
    })
  })

  it('sets client_reference_id to the brand profile id, not the auth user id', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({ ...baseCheckoutParams, tier: 1 })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['client_reference_id']).toBe(BRAND_PROFILE_ID)
  })

  it('passes existing customerId when provided', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({ ...baseCheckoutParams, tier: 1, customerId: 'cus_existing' })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['customer']).toBe('cus_existing')
  })

  it('throws when Stripe call fails', async () => {
    mockCheckoutCreate.mockRejectedValueOnce(new Error('Stripe unavailable'))

    await expect(createCheckoutSession({ ...baseCheckoutParams, tier: 1 })).rejects.toThrow(
      'Stripe unavailable'
    )
  })

  it('fails fast with a named error when a tier price id is missing', async () => {
    delete process.env['STRIPE_PRICE_TIER_1']
    resetEnvCache()

    await expect(createCheckoutSession({ ...baseCheckoutParams, tier: 1 })).rejects.toThrow(
      /STRIPE_PRICE_TIER_1/
    )

    setEnv()
  })
})

// ---------------------------------------------------------------------------
// createPaymentIntent
// ---------------------------------------------------------------------------

// ST-6: proposals.pay_amount is MAJOR units; Stripe bills in minor. Passing the
// major figure through charged every deal at 1/100th of its agreed value.
describe('toMinorUnits', () => {
  it('converts pounds to pence', () => {
    expect(toMinorUnits(5000)).toBe(500_000)
    expect(toMinorUnits(1)).toBe(100)
  })

  // 4.35 * 100 is 434.99999999999994 in IEEE 754, so truncating bills a penny
  // short. Stripe rejects a non-integer amount outright.
  it('rounds rather than truncates', () => {
    expect(Math.trunc(4.35 * 100)).toBe(434)
    expect(toMinorUnits(4.35)).toBe(435)
    expect(toMinorUnits(49.99)).toBe(4999)
    expect(Number.isInteger(toMinorUnits(1234.56))).toBe(true)
  })

  it('handles zero', () => {
    expect(toMinorUnits(0)).toBe(0)
  })
})

describe('createPaymentIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  const baseIntent = {
    contractId: CONTRACT_ID,
    payerId: PAYER_ID,
    payeeId: PAYEE_ID,
    amountMinor: 5_000_000,
    currency: 'gbp',
    customerId: 'cus_brand',
  }

  it('creates a payment intent and returns clientSecret and paymentIntentId', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    const result = await createPaymentIntent(baseIntent)

    expect(result).toEqual({
      clientSecret: PAYMENT_INTENT.client_secret,
      paymentIntentId: PAYMENT_INTENT.id,
    })
  })

  it('emits contractId, payerId and payeeId in metadata (ST-5)', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    await createPaymentIntent(baseIntent)

    const params = mockPaymentIntentsCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params['metadata']).toEqual({
      contractId: CONTRACT_ID,
      payerId: PAYER_ID,
      payeeId: PAYEE_ID,
    })
  })

  it('uses contractId as idempotency key', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    await createPaymentIntent(baseIntent)

    const call = mockPaymentIntentsCreate.mock.calls[0]
    expect((call?.[1] as Record<string, unknown>)?.['idempotencyKey']).toBe(`pi_${CONTRACT_ID}`)
  })

  // ST-6: the parameter is minor units and is named for it. The caller converts
  // with toMinorUnits; this function must not convert again.
  it('passes amountMinor straight through as Stripe amount, with currency and customerId', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    await createPaymentIntent({ ...baseIntent, amountMinor: 7_500_000, currency: 'usd', customerId: 'cus_xyz' })

    const params = mockPaymentIntentsCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params['amount']).toBe(7_500_000)
    expect(params['currency']).toBe('usd')
    expect(params['customer']).toBe('cus_xyz')
  })

  it('throws when Stripe returns an error', async () => {
    mockPaymentIntentsCreate.mockRejectedValueOnce(new Error('Card declined'))

    await expect(createPaymentIntent(baseIntent)).rejects.toThrow('Card declined')
  })
})

// ---------------------------------------------------------------------------
// retrieveChargeSettlement
// ---------------------------------------------------------------------------

describe('retrieveChargeSettlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  it('expands balance_transaction and returns fee, net and receipt url', async () => {
    mockChargesRetrieve.mockResolvedValueOnce({
      id: 'ch_abc',
      receipt_url: 'https://receipts.stripe.com/abc',
      balance_transaction: { fee: 1750, net: 48250 },
    })

    const result = await retrieveChargeSettlement('ch_abc')

    expect(mockChargesRetrieve).toHaveBeenCalledWith('ch_abc', {
      expand: ['balance_transaction'],
    })
    expect(result).toEqual({
      chargeId: 'ch_abc',
      receiptUrl: 'https://receipts.stripe.com/abc',
      stripeFee: 1750,
      netAmount: 48250,
    })
  })

  it('returns null fee/net when the balance transaction is still an unexpanded id', async () => {
    mockChargesRetrieve.mockResolvedValueOnce({
      id: 'ch_pending',
      receipt_url: null,
      balance_transaction: 'txn_pending',
    })

    const result = await retrieveChargeSettlement('ch_pending')

    expect(result.stripeFee).toBeNull()
    expect(result.netAmount).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// retrieveSubscription
// ---------------------------------------------------------------------------

describe('retrieveSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  it('returns the subscription from Stripe', async () => {
    mockSubscriptionsRetrieve.mockResolvedValueOnce({ id: 'sub_abc', status: 'active' })

    const result = await retrieveSubscription('sub_abc')

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_abc')
    expect(result.id).toBe('sub_abc')
  })
})

// ---------------------------------------------------------------------------
// cancelSubscription
// ---------------------------------------------------------------------------

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  it('schedules subscription cancellation at period end via update', async () => {
    mockSubscriptionsUpdate.mockResolvedValueOnce({ id: 'sub_abc', cancel_at_period_end: true })

    await cancelSubscription('sub_abc')

    const call = mockSubscriptionsUpdate.mock.calls[0]
    expect(call?.[0]).toBe('sub_abc')
    expect((call?.[1] as Record<string, unknown>)?.['cancel_at_period_end']).toBe(true)
  })

  it('resolves without returning a value', async () => {
    mockSubscriptionsUpdate.mockResolvedValueOnce({ id: 'sub_xyz' })

    const result = await cancelSubscription('sub_xyz')

    expect(result).toBeUndefined()
  })

  it('throws when Stripe returns an error', async () => {
    mockSubscriptionsUpdate.mockRejectedValueOnce(new Error('Subscription not found'))

    await expect(cancelSubscription('sub_bad')).rejects.toThrow('Subscription not found')
  })
})

// ---------------------------------------------------------------------------
// constructWebhookEvent
// ---------------------------------------------------------------------------

describe('constructWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEnv()
  })

  it('returns a Stripe event for a valid signature', () => {
    const fakeEvent = { type: 'payment_intent.succeeded', data: { object: {} } }
    mockWebhooksConstructEvent.mockReturnValueOnce(fakeEvent)

    const result = constructWebhookEvent('raw-body', 'valid-sig', 'whsec_test')

    expect(result).toEqual(fakeEvent)
    expect(mockWebhooksConstructEvent).toHaveBeenCalledWith('raw-body', 'valid-sig', 'whsec_test')
  })

  it('throws StripeSignatureVerificationError for invalid signature', () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      const err = new Error('No signatures found matching the expected signature')
      err.name = 'StripeSignatureVerificationError'
      throw err
    })

    expect(() => constructWebhookEvent('raw-body', 'bad-sig', 'whsec_test')).toThrow(
      'No signatures found matching the expected signature'
    )
  })

  it('rethrows unexpected errors unchanged', () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      throw new Error('Unexpected parse error')
    })

    expect(() => constructWebhookEvent('body', 'sig', 'secret')).toThrow('Unexpected parse error')
  })
})

// ---------------------------------------------------------------------------
// Reconciliation helpers (ST-3 / ST-4 / ST-6)
// ---------------------------------------------------------------------------

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    current_period_start: 1_760_000_000,
    current_period_end: 1_762_592_000,
    trial_end: null,
    canceled_at: null,
    metadata: { brandProfileId: BRAND_PROFILE_ID, userId: USER_ID },
    items: { data: [{ price: { metadata: { tier: '2' } } }] },
    ...overrides,
  }
}

describe('mapStripeSubscriptionStatus', () => {
  it('passes through statuses the local enum shares', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active')
    expect(mapStripeSubscriptionStatus('trialing')).toBe('trialing')
    expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled')
    expect(mapStripeSubscriptionStatus('paused')).toBe('paused')
  })

  it('maps Stripe-only statuses onto the closest truthful local value', () => {
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('incomplete')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('incomplete_expired')).toBe('canceled')
  })
})

describe('toSubscriptionSnapshot', () => {
  it('normalises ids, status, tier and unix timestamps', () => {
    // as unknown as never: the fixture is a structural stand-in for the parts of
    // Stripe.Subscription this helper reads; the full SDK type is ~80 fields.
    const snap = toSubscriptionSnapshot(stripeSub() as unknown as never)

    expect(snap.stripeSubscriptionId).toBe('sub_1')
    expect(snap.stripeCustomerId).toBe('cus_1')
    expect(snap.brandProfileId).toBe(BRAND_PROFILE_ID)
    expect(snap.status).toBe('active')
    expect(snap.tier).toBe(2)
    expect(snap.currentPeriodStart).toBe(new Date(1_760_000_000 * 1000).toISOString())
    expect(snap.currentPeriodEnd).toBe(new Date(1_762_592_000 * 1000).toISOString())
    expect(snap.trialEndsAt).toBeNull()
    expect(snap.canceledAt).toBeNull()
  })

  it('reads the customer id from an expanded customer object', () => {
    const snap = toSubscriptionSnapshot(
      stripeSub({ customer: { id: 'cus_expanded' } }) as unknown as never
    )
    expect(snap.stripeCustomerId).toBe('cus_expanded')
  })

  it('returns a null customer id rather than a blank string', () => {
    const snap = toSubscriptionSnapshot(stripeSub({ customer: null }) as unknown as never)
    expect(snap.stripeCustomerId).toBeNull()
  })

  it('returns a null brand profile id when metadata is absent', () => {
    const snap = toSubscriptionSnapshot(stripeSub({ metadata: {} }) as unknown as never)
    expect(snap.brandProfileId).toBeNull()
  })

  it('falls back to tier 1 for missing or nonsense tier metadata', () => {
    expect(
      toSubscriptionSnapshot(stripeSub({ items: { data: [] } }) as unknown as never).tier
    ).toBe(1)
    expect(
      toSubscriptionSnapshot(
        stripeSub({ items: { data: [{ price: { metadata: { tier: '9' } } }] } }) as unknown as never
      ).tier
    ).toBe(1)
  })
})

describe('listSubscriptionsPage', () => {
  it('requests every status so cancellations are visible, and caps the page size', async () => {
    mockSubscriptionsList.mockResolvedValueOnce({ data: [stripeSub()], has_more: false })

    const page = await listSubscriptionsPage()

    expect(mockSubscriptionsList).toHaveBeenCalledWith({
      limit: STRIPE_LIST_MAX_PAGE_SIZE,
      status: 'all',
    })
    expect(page.subscriptions).toHaveLength(1)
    expect(page.hasMore).toBe(false)
  })

  it('clamps an over-large limit to Stripe’s maximum', async () => {
    mockSubscriptionsList.mockResolvedValueOnce({ data: [], has_more: false })
    await listSubscriptionsPage({ limit: 5000 })
    expect(mockSubscriptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: STRIPE_LIST_MAX_PAGE_SIZE })
    )
  })

  it('passes the cursor through and returns the next one from the last row', async () => {
    mockSubscriptionsList.mockResolvedValueOnce({
      data: [stripeSub({ id: 'sub_a' }), stripeSub({ id: 'sub_b' })],
      has_more: true,
    })

    const page = await listSubscriptionsPage({ startingAfter: 'sub_prev' })

    expect(mockSubscriptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ starting_after: 'sub_prev' })
    )
    expect(page.nextCursor).toBe('sub_b')
    expect(page.hasMore).toBe(true)
  })

  it('reports a null cursor for an empty page', async () => {
    mockSubscriptionsList.mockResolvedValueOnce({ data: [], has_more: false })
    const page = await listSubscriptionsPage()
    expect(page.nextCursor).toBeNull()
    expect(page.subscriptions).toEqual([])
  })
})

describe('isStripeResourceMissing / retrieveSubscriptionSnapshot', () => {
  it('recognises Stripe’s resource_missing code', () => {
    expect(isStripeResourceMissing({ code: 'resource_missing' })).toBe(true)
    expect(
      isStripeResourceMissing({ type: 'StripeInvalidRequestError', statusCode: 404 })
    ).toBe(true)
  })

  it('does not treat other failures as missing', () => {
    expect(isStripeResourceMissing(new Error('network down'))).toBe(false)
    expect(isStripeResourceMissing({ code: 'rate_limit' })).toBe(false)
    expect(isStripeResourceMissing(null)).toBe(false)
  })

  it('returns a snapshot when Stripe has the subscription', async () => {
    mockSubscriptionsRetrieve.mockResolvedValueOnce(stripeSub({ id: 'sub_live' }))
    const snap = await retrieveSubscriptionSnapshot('sub_live')
    expect(snap?.stripeSubscriptionId).toBe('sub_live')
  })

  it('returns null when Stripe 404s', async () => {
    mockSubscriptionsRetrieve.mockRejectedValueOnce({ code: 'resource_missing' })
    expect(await retrieveSubscriptionSnapshot('sub_gone')).toBeNull()
  })

  it('rethrows a transient Stripe failure instead of claiming the subscription is gone', async () => {
    mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('503 from Stripe'))
    await expect(retrieveSubscriptionSnapshot('sub_x')).rejects.toThrow('503 from Stripe')
  })
})
