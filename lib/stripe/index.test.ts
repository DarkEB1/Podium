import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before vi.mock() factory runs
// ---------------------------------------------------------------------------

const mockCheckoutCreate = vi.hoisted(() => vi.fn())
const mockPaymentIntentsCreate = vi.hoisted(() => vi.fn())
const mockSubscriptionsUpdate = vi.hoisted(() => vi.fn())
const mockWebhooksConstructEvent = vi.hoisted(() => vi.fn())

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCheckoutCreate } },
    paymentIntents: { create: mockPaymentIntentsCreate },
    subscriptions: { update: mockSubscriptionsUpdate },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  })),
}))

// Import after mocking
import {
  createCheckoutSession,
  createPaymentIntent,
  cancelSubscription,
  constructWebhookEvent,
} from './index'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['STRIPE_PRICE_TIER_1'] = 'price_tier1'
    process.env['STRIPE_PRICE_TIER_2'] = 'price_tier2'
    process.env['STRIPE_PRICE_TIER_3'] = 'price_tier3'
  })

  it('creates a checkout session for tier 1 and returns url and sessionId', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    const result = await createCheckoutSession({
      brandId: 'brand-123',
      tier: 1,
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    expect(result).toEqual({ url: SESSION.url, sessionId: SESSION.id })
  })

  it('creates a checkout session for tier 2', async () => {
    mockCheckoutCreate.mockResolvedValueOnce({ ...SESSION, id: 'cs_tier2', url: 'https://checkout.stripe.com/pay/cs_tier2' })

    const result = await createCheckoutSession({
      brandId: 'brand-456',
      tier: 2,
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    expect(result.sessionId).toBe('cs_tier2')
  })

  it('passes trial_period_days: 7 in subscription_data', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({
      brandId: 'brand-123',
      tier: 1,
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect((call['subscription_data'] as Record<string, unknown>)?.['trial_period_days']).toBe(7)
  })

  it('includes brandId in client_reference_id', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({
      brandId: 'brand-789',
      tier: 1,
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['client_reference_id']).toBe('brand-789')
  })

  it('passes existing customerId when provided', async () => {
    mockCheckoutCreate.mockResolvedValueOnce(SESSION)

    await createCheckoutSession({
      brandId: 'brand-123',
      tier: 1,
      customerId: 'cus_existing',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    })

    const call = mockCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['customer']).toBe('cus_existing')
  })

  it('throws StripeError when Stripe call fails', async () => {
    mockCheckoutCreate.mockRejectedValueOnce(new Error('Stripe unavailable'))

    await expect(
      createCheckoutSession({
        brandId: 'brand-123',
        tier: 1,
        successUrl: 'https://app.test/success',
        cancelUrl: 'https://app.test/cancel',
      })
    ).rejects.toThrow('Stripe unavailable')
  })
})

// ---------------------------------------------------------------------------
// createPaymentIntent
// ---------------------------------------------------------------------------

describe('createPaymentIntent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a payment intent and returns clientSecret and paymentIntentId', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    const result = await createPaymentIntent({
      contractId: 'contract-abc',
      amount: 50000,
      currency: 'gbp',
      customerId: 'cus_brand',
    })

    expect(result).toEqual({
      clientSecret: PAYMENT_INTENT.client_secret,
      paymentIntentId: PAYMENT_INTENT.id,
    })
  })

  it('uses contractId as idempotency key', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    await createPaymentIntent({
      contractId: 'contract-idempotent',
      amount: 10000,
      currency: 'gbp',
      customerId: 'cus_brand',
    })

    const call = mockPaymentIntentsCreate.mock.calls[0]
    // Second argument is options (idempotency key)
    expect((call?.[1] as Record<string, unknown>)?.['idempotencyKey']).toBe('pi_contract-idempotent')
  })

  it('passes amount, currency, and customerId to Stripe', async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce(PAYMENT_INTENT)

    await createPaymentIntent({
      contractId: 'contract-abc',
      amount: 75000,
      currency: 'usd',
      customerId: 'cus_xyz',
    })

    const params = mockPaymentIntentsCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params['amount']).toBe(75000)
    expect(params['currency']).toBe('usd')
    expect(params['customer']).toBe('cus_xyz')
  })

  it('throws when Stripe returns an error', async () => {
    mockPaymentIntentsCreate.mockRejectedValueOnce(new Error('Card declined'))

    await expect(
      createPaymentIntent({
        contractId: 'contract-fail',
        amount: 5000,
        currency: 'gbp',
        customerId: 'cus_fail',
      })
    ).rejects.toThrow('Card declined')
  })
})

// ---------------------------------------------------------------------------
// cancelSubscription
// ---------------------------------------------------------------------------

describe('cancelSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

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
  beforeEach(() => vi.clearAllMocks())

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
