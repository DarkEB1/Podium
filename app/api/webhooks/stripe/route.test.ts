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
  }
})
vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>()
  return { ...actual, constructWebhookEvent: vi.fn() }
})

import { createAdminClient } from '@/lib/supabase/server'
import {
  upsertSubscription,
  updateSubscription,
  createPaymentRecord,
  updatePaymentRecord,
} from '@/lib/supabase/payments'
import { constructWebhookEvent } from '@/lib/stripe'
import { POST } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body = '{}', signature = 'valid-sig') {
  return new NextRequest(new URL('/api/webhooks/stripe', 'http://localhost'), {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

function makeSubscriptionEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      object: {
        id: 'sub_abc',
        customer: 'cus_abc',
        status: 'active',
        items: { data: [{ price: { metadata: { tier: '1' } } }] },
        current_period_start: 1714521600,
        current_period_end: 1717200000,
        trial_end: null,
        canceled_at: null,
        cancel_at_period_end: false,
        client_reference_id: 'user-brand',
        metadata: { brandUserId: 'user-brand' },
        ...overrides,
      },
    },
  }
}

function makePaymentIntentEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      object: {
        id: 'pi_abc',
        amount: 50000,
        currency: 'gbp',
        customer: 'cus_abc',
        metadata: { contractId: 'contract-1' },
        status: type === 'payment_intent.succeeded' ? 'succeeded' : 'requires_payment_method',
        charges: {
          data: [{
            balance_transaction: {
              fee: 1750,
              net: 48250,
            },
            receipt_url: 'https://receipts.stripe.com/abc',
            amount: 50000,
          }],
        },
        ...overrides,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — signature verification', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

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

  it('returns 200 for unknown event types (no-op)', async () => {
    vi.mocked(constructWebhookEvent).mockReturnValueOnce({ type: 'unknown.event', data: { object: {} } } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.created
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.created', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('calls upsertSubscription with correct data', async () => {
    const event = makeSubscriptionEvent('customer.subscription.created')
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
    vi.mocked(upsertSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest(JSON.stringify(event.data.object)))

    expect(res.status).toBe(200)
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stripe_subscription_id: 'sub_abc',
        stripe_customer_id: 'cus_abc',
        status: 'active',
      })
    )
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.updated
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.updated', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('calls updateSubscription with updated fields', async () => {
    const event = makeSubscriptionEvent('customer.subscription.updated', { status: 'past_due' })
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
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
    const event = makeSubscriptionEvent('customer.subscription.deleted', {
      status: 'canceled',
      canceled_at: 1714521600,
    })
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
    vi.mocked(updateSubscription).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSubscription)).toHaveBeenCalledWith(
      expect.anything(),
      'sub_abc',
      expect.objectContaining({ status: 'canceled' })
    )
  })
})

// ---------------------------------------------------------------------------
// payment_intent.created
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.created', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('calls createPaymentRecord when contractId is in metadata', async () => {
    const event = makePaymentIntentEvent('payment_intent.created')
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
    vi.mocked(createPaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stripe_payment_intent_id: 'pi_abc',
        amount: 50000,
        currency: 'GBP',
      })
    )
  })

  it('returns 200 without error when no contractId in metadata (non-deal intent)', async () => {
    const event = makePaymentIntentEvent('payment_intent.created', { metadata: {} })
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(createPaymentRecord)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// payment_intent.succeeded
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.succeeded', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('calls updatePaymentRecord with succeeded status and fee breakdown', async () => {
    const event = makePaymentIntentEvent('payment_intent.succeeded')
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
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
})

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — payment_intent.payment_failed', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({} as never)
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
  })

  it('calls updatePaymentRecord with failed status', async () => {
    const event = makePaymentIntentEvent('payment_intent.payment_failed')
    vi.mocked(constructWebhookEvent).mockReturnValueOnce(event as never)
    vi.mocked(updatePaymentRecord).mockResolvedValueOnce({} as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(vi.mocked(updatePaymentRecord)).toHaveBeenCalledWith(
      expect.anything(),
      'pi_abc',
      expect.objectContaining({ status: 'failed' })
    )
  })
})
