import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/payments')>()
  return {
    ...actual,
    upsertSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    createPaymentRecord: vi.fn(),
    updatePaymentRecord: vi.fn(),
    getPaymentByIntentId: vi.fn(),
    getSubscriptionByStripeCustomerId: vi.fn(),
    claimWebhookEvent: vi.fn(),
    markWebhookEvent: vi.fn(),
  }
})
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return {
    ...actual,
    constructWebhookEvent: vi.fn(),
    retrieveChargeSettlement: vi.fn(),
    retrieveSubscription: vi.fn(),
  }
})
vi.mock('@/lib/email', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('@/lib/email/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/notify')>()
  return { ...actual, resolveDisplayNames: vi.fn() }
})

import { createAdminClient } from '@/lib/supabase/server'
import {
  upsertSubscription,
  updateSubscription,
  createPaymentRecord,
  updatePaymentRecord,
  getPaymentByIntentId,
  getSubscriptionByStripeCustomerId,
  claimWebhookEvent,
  markWebhookEvent,
  PaymentsError,
} from '@/lib/supabase/payments'
import {
  constructWebhookEvent,
  retrieveChargeSettlement,
  retrieveSubscription,
} from '@/lib/stripe'
import { sendTransactionalEmail } from '@/lib/email'
import { resolveDisplayNames } from '@/lib/email/notify'
import { resetEnvCache } from '@/lib/env'
import { POST } from './route'

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const BRAND_PROFILE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CONTRACT_ID = '33333333-3333-4333-8333-333333333333'
const PAYER_ID = '44444444-4444-4444-8444-444444444444'
const PAYEE_ID = '55555555-5555-4555-8555-555555555555'

const SUB_METADATA = { brandProfileId: BRAND_PROFILE_ID, userId: USER_ID }
const PI_METADATA = { contractId: CONTRACT_ID, payerId: PAYER_ID, payeeId: PAYEE_ID }

function setEnv() {
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_123'
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  process.env['STRIPE_PRICE_TIER_1'] = 'price_1'
  process.env['STRIPE_PRICE_TIER_2'] = 'price_2'
  process.env['STRIPE_PRICE_TIER_3'] = 'price_3'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key'
  resetEnvCache()
}

function makeRequest(body = '{}', signature = 'valid-sig') {
  return new NextRequest(new URL('/api/webhooks/stripe', 'http://localhost'), {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

let eventCounter = 0

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_abc',
    customer: 'cus_abc',
    status: 'active',
    items: { data: [{ price: { metadata: { tier: '2' } } }] },
    current_period_start: 1714521600,
    current_period_end: 1717200000,
    trial_end: null,
    canceled_at: null,
    cancel_at_period_end: false,
    metadata: SUB_METADATA,
    ...overrides,
  }
}

function makeEvent(type: string, object: Record<string, unknown>) {
  eventCounter += 1
  return { id: `evt_${eventCounter}`, type, data: { object } }
}

function makeSubscriptionEvent(type: string, overrides: Record<string, unknown> = {}) {
  return makeEvent(type, stripeSubscription(overrides))
}

function makePaymentIntentEvent(type: string, overrides: Record<string, unknown> = {}) {
  return makeEvent(type, {
    id: 'pi_abc',
    amount: 50000,
    currency: 'gbp',
    customer: 'cus_abc',
    metadata: PI_METADATA,
    latest_charge: 'ch_abc',
    status: type === 'payment_intent.succeeded' ? 'succeeded' : 'requires_payment_method',
    ...overrides,
  })
}

function mockEvent(event: unknown) {
  vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  setEnv()
  vi.mocked(createAdminClient).mockReturnValue({} as never)
  vi.mocked(claimWebhookEvent).mockResolvedValue({
    claimed: true,
    attempts: 1,
    status: 'received',
  })
  vi.mocked(markWebhookEvent).mockResolvedValue(undefined)
  vi.mocked(resolveDisplayNames).mockResolvedValue({})
  vi.mocked(sendTransactionalEmail).mockResolvedValue({
    status: 'sent',
    deliveryId: 'd1',
    providerId: 'p1',
  })
})

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — signature verification', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest(new URL('/api/webhooks/stripe', 'http://localhost'), {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('MISSING_SIGNATURE')
  })

  it('returns 400 when signature verification fails', async () => {
    vi.mocked(constructWebhookEvent).mockImplementationOnce(() => {
      const err = new Error('No signatures found')
      err.name = 'StripeSignatureVerificationError'
      throw err
    })
    const res = await POST(makeRequest('{}', 'bad-sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_SIGNATURE')
  })

  it('never records or processes an event with a bad signature', async () => {
    vi.mocked(constructWebhookEvent).mockImplementationOnce(() => {
      throw new Error('bad sig')
    })
    await POST(makeRequest('{}', 'bad-sig'))
    expect(vi.mocked(claimWebhookEvent)).not.toHaveBeenCalled()
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
  })

  it('returns 500 when the webhook secret is not configured', async () => {
    delete process.env['STRIPE_WEBHOOK_SECRET']
    resetEnvCache()
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('WEBHOOK_NOT_CONFIGURED')
    setEnv()
  })

  it('returns 200 for unknown event types (no-op)', async () => {
    mockEvent(makeEvent('unknown.event', {}))
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Idempotency + poison-event guard
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — idempotency and poison-event guard', () => {
  it('claims the event after signature verification', async () => {
    const event = makeSubscriptionEvent('customer.subscription.created')
    mockEvent(event)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(claimWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: event.id, type: 'customer.subscription.created' })
    )
  })

  it('marks the event processed on success', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'processed'
    )
  })

  it('short-circuits a retry of an already-processed event', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: false,
      attempts: 1,
      status: 'processed',
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).duplicate).toBe(true)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
  })

  it('does not re-run an event previously marked unprocessable', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: false,
      attempts: 1,
      status: 'unprocessable',
    })

    await POST(makeRequest())
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
  })

  it('retries an event previously marked failed (transient)', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    // The claim RPC grants a claim on a `failed` row and reports attempt 2.
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: true,
      attempts: 2,
      status: 'received',
    })
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalled()
  })

  // D3(a): the claim is atomic, so the delivery that loses the race must not
  // enter the handlers even though the event has no terminal status yet.
  it('never runs handlers for a delivery that lost the claim race', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: false,
      attempts: 1,
      status: 'received',
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
    expect(vi.mocked(markWebhookEvent)).not.toHaveBeenCalled()
  })

  it('returns 500 when the event log itself is unavailable so Stripe retries', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockRejectedValueOnce(
      new PaymentsError('WEBHOOK_EVENT_CLAIM_FAILED', 'connection refused')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('EVENT_LOG_UNAVAILABLE')
  })

  it('returns 500 and marks failed on a transient handler failure (DB down)', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(
      new PaymentsError('SUBSCRIPTION_UPSERT_FAILED', 'connection reset')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('HANDLER_FAILED')
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'failed',
      'connection reset'
    )
  })

  it('returns 200 and marks unprocessable on an unrecoverable handler failure', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.updated'))
    vi.mocked(updateSubscription).mockRejectedValueOnce(
      new PaymentsError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
    )

    const res = await POST(makeRequest())

    // 200 → Stripe stops retrying an event that can never succeed
    expect(res.status).toBe(200)
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      'Subscription not found'
    )
  })
})

// ---------------------------------------------------------------------------
// D1 — failure classification defaults to transient
//
// Regression tests for permanent event loss: an unrecognised error used to be
// recorded as terminal and answered 200, so Stripe never retried and every
// later redelivery short-circuited on the idempotency check.
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — failure classification', () => {
  function stripeError(name: string, message: string, code?: string) {
    const err = new Error(message)
    err.name = name
    if (code) {
      // as Error & { code?: string }: mirrors the Stripe SDK error shape, which
      // carries a machine-readable `code` that is not on the Error interface.
      ;(err as Error & { code?: string }).code = code
    }
    return err
  }

  it('treats an unknown error type (TypeError) as transient — 500, not 200', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(
      new TypeError('Cannot read properties of undefined')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('HANDLER_FAILED')
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'failed',
      expect.any(String)
    )
  })

  it('treats an undici `fetch failed` as transient', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(new Error('fetch failed'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })

  it('treats an AggregateError as transient', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(
      new AggregateError([new Error('ECONNREFUSED')], 'all lookups failed')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })

  it('treats a non-Error throw as transient', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce('something went very wrong')

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })

  it('still treats a Stripe connection error as transient', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(
      stripeError('StripeConnectionError', 'network error')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })

  it('marks a Stripe resource_missing error unprocessable', async () => {
    mockEvent(
      makeEvent('checkout.session.completed', {
        id: 'cs_gone',
        mode: 'subscription',
        subscription: 'sub_gone',
        client_reference_id: BRAND_PROFILE_ID,
        metadata: SUB_METADATA,
      })
    )
    vi.mocked(retrieveSubscription).mockRejectedValueOnce(
      stripeError('StripeInvalidRequestError', 'No such subscription', 'resource_missing')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('No such subscription')
    )
  })

  it('marks a ZodError unprocessable — the payload can never validate', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockRejectedValueOnce(
      stripeError('ZodError', 'invalid uuid')
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
  })

  it('gives up on a transient failure once the attempt budget is spent', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: true,
      attempts: 8,
      status: 'received',
    })
    vi.mocked(upsertSubscription).mockRejectedValueOnce(new Error('fetch failed'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('giving up after 8 attempts')
    )
  })

  it('does not give up before the attempt budget is spent', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(claimWebhookEvent).mockResolvedValueOnce({
      claimed: true,
      attempts: 7,
      status: 'received',
    })
    vi.mocked(upsertSubscription).mockRejectedValueOnce(new Error('fetch failed'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// checkout.session.completed (ST-3)
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — checkout.session.completed', () => {
  it('links customer + subscription to the brand profile from metadata', async () => {
    mockEvent(
      makeEvent('checkout.session.completed', {
        id: 'cs_abc',
        mode: 'subscription',
        subscription: 'sub_abc',
        customer: 'cus_abc',
        client_reference_id: BRAND_PROFILE_ID,
        metadata: SUB_METADATA,
      })
    )
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(stripeSubscription() as never)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        brand_id: BRAND_PROFILE_ID,
        stripe_subscription_id: 'sub_abc',
        stripe_customer_id: 'cus_abc',
        tier: 2,
        status: 'active',
      })
    )
  })

  it('falls back to client_reference_id when metadata is absent', async () => {
    mockEvent(
      makeEvent('checkout.session.completed', {
        id: 'cs_abc',
        mode: 'subscription',
        subscription: 'sub_abc',
        client_reference_id: BRAND_PROFILE_ID,
        metadata: {},
      })
    )
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(stripeSubscription({ metadata: {} }) as never)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ brand_id: BRAND_PROFILE_ID })
    )
  })

  it('ignores non-subscription checkout sessions', async () => {
    mockEvent(makeEvent('checkout.session.completed', { id: 'cs_x', mode: 'payment' }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
  })

  it('marks unprocessable when neither metadata nor client_reference_id identifies the brand', async () => {
    mockEvent(
      makeEvent('checkout.session.completed', {
        id: 'cs_abc',
        mode: 'subscription',
        subscription: 'sub_abc',
        client_reference_id: null,
        metadata: {},
      })
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('client_reference_id')
    )
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.created (B-2)
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.created', () => {
  it('sets brand_id from subscription metadata', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        brand_id: BRAND_PROFILE_ID,
        stripe_subscription_id: 'sub_abc',
        stripe_customer_id: 'cus_abc',
        status: 'active',
      })
    )
  })

  it('falls back to the brand already linked to this Stripe customer', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created', { metadata: {} }))
    vi.mocked(getSubscriptionByStripeCustomerId).mockResolvedValueOnce({
      brand_id: BRAND_PROFILE_ID,
    } as never)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(getSubscriptionByStripeCustomerId)).toHaveBeenCalledWith(
      expect.anything(),
      'cus_abc'
    )
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ brand_id: BRAND_PROFILE_ID })
    )
  })

  it('NEVER inserts an empty brand_id when it cannot be resolved (B-2)', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created', { metadata: {} }))
    vi.mocked(getSubscriptionByStripeCustomerId).mockResolvedValueOnce(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('brand_profiles.id')
    )
  })

  // D2: stripe_customer_id is `text not null` with no FK, so a placeholder ''
  // used to insert silently and then poison the customer-id fallback resolver.
  it('NEVER inserts a placeholder stripe_customer_id (D2)', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created', { customer: null }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('no Stripe customer id')
    )
  })

  it('inserts nothing from checkout.session.completed when the customer is unresolvable (D2)', async () => {
    mockEvent(
      makeEvent('checkout.session.completed', {
        id: 'cs_abc',
        mode: 'subscription',
        subscription: 'sub_abc',
        client_reference_id: BRAND_PROFILE_ID,
        metadata: SUB_METADATA,
      })
    )
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(
      stripeSubscription({ customer: null }) as never
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled()
  })

  it('maps a Stripe-only status onto the local subscription_status enum', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'unpaid' }))
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'past_due' })
    )
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.updated / deleted
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.updated', () => {
  it('calls updateSubscription with updated fields', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.updated', { status: 'past_due' }))
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      'sub_abc',
      expect.objectContaining({ status: 'past_due' })
    )
  })

  it('sets canceled_at when subscription is deleted', async () => {
    mockEvent(
      makeSubscriptionEvent('customer.subscription.deleted', {
        status: 'canceled',
        canceled_at: 1714521600,
      })
    )
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      'sub_abc',
      expect.objectContaining({ status: 'canceled', canceled_at: '2024-05-01T00:00:00.000Z' })
    )
  })
})

// ---------------------------------------------------------------------------
// invoice.payment_succeeded / failed (ST-4 / ST-6)
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — invoice lifecycle', () => {
  it('refreshes status and period dates on invoice.payment_succeeded', async () => {
    mockEvent(
      makeEvent('invoice.payment_succeeded', {
        id: 'in_abc',
        subscription: 'sub_abc',
        customer: 'cus_abc',
      })
    )
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(
      stripeSubscription({
        status: 'active',
        current_period_start: 1717200000,
        current_period_end: 1719878400,
      }) as never
    )
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      'sub_abc',
      expect.objectContaining({
        status: 'active',
        current_period_start: '2024-06-01T00:00:00.000Z',
        current_period_end: '2024-07-02T00:00:00.000Z',
      })
    )
  })

  it('moves the subscription to past_due on invoice.payment_failed', async () => {
    mockEvent(
      makeEvent('invoice.payment_failed', { id: 'in_bad', subscription: 'sub_abc' })
    )
    // Stripe has not flipped the status yet at delivery time
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(
      stripeSubscription({ status: 'active' }) as never
    )
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(updateSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      'sub_abc',
      expect.objectContaining({ status: 'past_due' })
    )
  })

  it('ignores one-off invoices with no subscription', async () => {
    mockEvent(makeEvent('invoice.payment_succeeded', { id: 'in_x', subscription: null }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSubscription)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// payment_intent.created (ST-5)
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.created', () => {
  it('creates the payment record from the shared metadata contract', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.created'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce(null)
    vi.mocked(createPaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stripe_payment_intent_id: 'pi_abc',
        contract_id: CONTRACT_ID,
        payer_id: PAYER_ID,
        payee_id: PAYEE_ID,
        amount: 50000,
        currency: 'GBP',
      })
    )
  })

  it('returns 200 without inserting when there is no contractId (non-deal intent)', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.created', { metadata: {} }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).not.toHaveBeenCalled()
  })

  it('never inserts an invalid row when payerId/payeeId are missing (ST-5)', async () => {
    mockEvent(
      makePaymentIntentEvent('payment_intent.created', { metadata: { contractId: CONTRACT_ID } })
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).not.toHaveBeenCalled()
    expect(vi.mocked(markWebhookEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'unprocessable',
      expect.stringContaining('incomplete')
    )
  })

  it('does not duplicate a row the intents route already inserted', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.created'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({ id: 'pay-1' } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// payment_intent.succeeded / charge.succeeded
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.succeeded', () => {
  it('reads fee/net/receipt from latest_charge, not the removed charges list', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.succeeded'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({ id: 'pay-1' } as never)
    vi.mocked(retrieveChargeSettlement).mockResolvedValueOnce({
      chargeId: 'ch_abc',
      receiptUrl: 'https://receipts.stripe.com/abc',
      stripeFee: 1750,
      netAmount: 48250,
    })
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(retrieveChargeSettlement)).toHaveBeenCalledWith('ch_abc')
    expect(vi.mocked(updatePaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      'pi_abc',
      expect.objectContaining({
        status: 'succeeded',
        stripe_fee: 1750,
        net_amount: 48250,
        receipt_url: 'https://receipts.stripe.com/abc',
      })
    )
  })

  // D3(b): a status write can always fail, after which Stripe replays an event
  // whose effects were already applied. settlePayment must be a no-op then,
  // rather than rewriting processed_at.
  it('is a no-op when the payment has already settled (replay-safe)', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.succeeded'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({
      id: 'pay-1',
      status: 'succeeded',
      processed_at: '2026-07-20T00:00:00Z',
    } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).not.toHaveBeenCalled()
    expect(vi.mocked(retrieveChargeSettlement)).not.toHaveBeenCalled()
  })

  it('marks unprocessable when no payments row exists for the intent', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.succeeded'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).not.toHaveBeenCalled()
  })

  it('handles charge.succeeded for the same settlement data', async () => {
    mockEvent(
      makeEvent('charge.succeeded', {
        id: 'ch_abc',
        payment_intent: 'pi_abc',
        metadata: PI_METADATA,
      })
    )
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({ id: 'pay-1' } as never)
    vi.mocked(retrieveChargeSettlement).mockResolvedValueOnce({
      chargeId: 'ch_abc',
      receiptUrl: 'https://receipts.stripe.com/abc',
      stripeFee: 1750,
      netAmount: 48250,
    })
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      'pi_abc',
      expect.objectContaining({ stripe_fee: 1750, net_amount: 48250 })
    )
  })

  it('ignores charges outside the deal-payment flow', async () => {
    mockEvent(makeEvent('charge.succeeded', { id: 'ch_x', payment_intent: 'pi_x', metadata: {} }))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.payment_failed', () => {
  it('calls updatePaymentRecord with failed status', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.payment_failed'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({ id: 'pay-1' } as never)
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      'pi_abc',
      expect.objectContaining({ status: 'failed' })
    )
  })

  // D3(b): replays and out-of-order deliveries must never undo a settlement.
  it('never downgrades an already-succeeded payment', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.payment_failed'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({
      id: 'pay-1',
      status: 'succeeded',
      processed_at: '2026-07-20T00:00:00Z',
    } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Transactional email side effects (payment_received / subscription_started /
// subscription_payment_failed). Each fires only after the primary DB write
// settles, carries an idempotency key so a Stripe redelivery cannot double-send,
// and keeps PII (names) out of the key.
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — email side effects', () => {
  const settledPaymentRow = {
    id: 'pay-1',
    status: 'pending',
    processed_at: null,
    payee_id: PAYEE_ID,
    payer_id: PAYER_ID,
    amount: 50000,
    currency: 'GBP',
  }

  it('emails the payee a payment_received when a payment settles', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.succeeded'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce(settledPaymentRow as never)
    vi.mocked(retrieveChargeSettlement).mockResolvedValueOnce({
      chargeId: 'ch_abc',
      receiptUrl: 'https://receipts.stripe.com/abc',
      stripeFee: 1750,
      netAmount: 48250,
    })
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'payment_received',
        userId: PAYEE_ID,
        idempotencyKey: 'payment_received:pi_abc',
        data: expect.objectContaining({ amountFormatted: '£500.00' }),
      })
    )
  })

  it('does NOT email a payment_received on an already-settled replay', async () => {
    mockEvent(makePaymentIntentEvent('payment_intent.succeeded'))
    vi.mocked(getPaymentByIntentId).mockResolvedValueOnce({
      ...settledPaymentRow,
      status: 'succeeded',
      processed_at: '2026-07-20T00:00:00Z',
    } as never)

    await POST(makeRequest())

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled()
  })

  it('emails the brand user a subscription_started when a subscription is created', async () => {
    mockEvent(makeSubscriptionEvent('customer.subscription.created'))
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'subscription_started',
        userId: USER_ID,
        idempotencyKey: 'subscription_started:sub_abc',
        data: expect.objectContaining({ tierName: 'Tier 2' }),
      })
    )
  })

  it('does NOT email subscription_started when the brand user id is not in metadata', async () => {
    // Brand resolved via the customer-link fallback — no userId to email.
    mockEvent(makeSubscriptionEvent('customer.subscription.created', { metadata: {} }))
    vi.mocked(getSubscriptionByStripeCustomerId).mockResolvedValueOnce({
      brand_id: BRAND_PROFILE_ID,
    } as never)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled()
  })

  it('emails the brand user a subscription_payment_failed on invoice.payment_failed', async () => {
    mockEvent(makeEvent('invoice.payment_failed', { id: 'in_bad', subscription: 'sub_abc' }))
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(
      stripeSubscription({ status: 'active' }) as never
    )
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'subscription_payment_failed',
        userId: USER_ID,
        idempotencyKey: 'subscription_payment_failed:in_bad',
      })
    )
  })

  it('does NOT email subscription_payment_failed on invoice.payment_succeeded', async () => {
    mockEvent(makeEvent('invoice.payment_succeeded', { id: 'in_ok', subscription: 'sub_abc' }))
    vi.mocked(retrieveSubscription).mockResolvedValueOnce(stripeSubscription() as never)
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    await POST(makeRequest())

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled()
  })
})
