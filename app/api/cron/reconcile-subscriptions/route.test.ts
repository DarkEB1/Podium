import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — Stripe is never contacted; lib/stripe is the only module that may
// call it, so the job is tested against its helper surface.
// ---------------------------------------------------------------------------

const listSubscriptionsPage = vi.hoisted(() => vi.fn())
const retrieveSubscriptionSnapshot = vi.hoisted(() => vi.fn())

const getSubscriptionByStripeSubscriptionId = vi.hoisted(() => vi.fn())
const getSubscriptionByStripeCustomerId = vi.hoisted(() => vi.fn())
const listStaleSubscriptions = vi.hoisted(() => vi.fn())
const upsertSubscription = vi.hoisted(() => vi.fn())
const updateSubscription = vi.hoisted(() => vi.fn())
const createAdminClient = vi.hoisted(() => vi.fn(() => ({ __admin: true })))
const captureMessage = vi.hoisted(() => vi.fn())
const captureException = vi.hoisted(() => vi.fn())

vi.mock('@/lib/stripe', () => ({
  listSubscriptionsPage: (...a: unknown[]) => listSubscriptionsPage(...a),
  retrieveSubscriptionSnapshot: (...a: unknown[]) => retrieveSubscriptionSnapshot(...a),
  STRIPE_LIST_MAX_PAGE_SIZE: 100,
}))

vi.mock('@/lib/supabase/payments', () => {
  class PaymentsError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message)
      this.name = 'PaymentsError'
    }
  }
  return {
    PaymentsError,
    getSubscriptionByStripeSubscriptionId: (...a: unknown[]) =>
      getSubscriptionByStripeSubscriptionId(...a),
    getSubscriptionByStripeCustomerId: (...a: unknown[]) =>
      getSubscriptionByStripeCustomerId(...a),
    listStaleSubscriptions: (...a: unknown[]) => listStaleSubscriptions(...a),
    upsertSubscription: (...a: unknown[]) => upsertSubscription(...a),
    updateSubscription: (...a: unknown[]) => updateSubscription(...a),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClient(),
}))

vi.mock('@/lib/observability', () => ({
  withRequestContext: () => ({
    captureMessage: (...a: unknown[]) => captureMessage(...a),
    captureException: (...a: unknown[]) => captureException(...a),
  }),
}))

import { GET, POST } from './route'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SECRET = 'super-secret-cron-token'
const BRAND = '11111111-1111-4111-8111-111111111111'

function request(headers: Record<string, string> = {}) {
  return new NextRequest('https://podium.test/api/cron/reconcile-subscriptions', { headers })
}

function authed() {
  return request({ authorization: `Bearer ${SECRET}` })
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    stripeSubscriptionId: 'sub_1',
    stripeCustomerId: 'cus_1',
    brandProfileId: BRAND,
    status: 'active',
    stripeStatus: 'active',
    tier: 2,
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    trialEndsAt: null,
    canceledAt: null,
    ...overrides,
  }
}

function localRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    brand_id: BRAND,
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    tier: 2,
    status: 'active',
    trial_ends_at: null,
    current_period_start: '2026-07-01T00:00:00+00:00',
    current_period_end: '2026-08-01T00:00:00+00:00',
    canceled_at: null,
    cancellation_scheduled_at: null,
    created_at: '2026-07-01T00:00:00+00:00',
    updated_at: '2026-07-01T00:00:00+00:00',
    ...overrides,
  }
}

/** No Stripe subscriptions, no stale local rows — the "nothing to do" baseline. */
function quiet() {
  listSubscriptionsPage.mockResolvedValue({ subscriptions: [], hasMore: false, nextCursor: null })
  listStaleSubscriptions.mockResolvedValue([])
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  vi.clearAllMocks()
  createAdminClient.mockReturnValue({ __admin: true })
  getSubscriptionByStripeSubscriptionId.mockResolvedValue(null)
  getSubscriptionByStripeCustomerId.mockResolvedValue(null)
  upsertSubscription.mockResolvedValue(localRow())
  updateSubscription.mockResolvedValue(localRow())
  retrieveSubscriptionSnapshot.mockResolvedValue(null)
  quiet()
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

// ---------------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions authorisation', () => {
  it('401s with no Authorization header and never contacts Stripe', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(listSubscriptionsPage).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('401s on a wrong secret', async () => {
    const res = await GET(request({ authorization: 'Bearer nope-nope-nope-nope' }))
    expect(res.status).toBe(401)
    expect(listSubscriptionsPage).not.toHaveBeenCalled()
  })

  it('401s on a non-Bearer scheme even with the right secret', async () => {
    const res = await GET(request({ authorization: `Basic ${SECRET}` }))
    expect(res.status).toBe(401)
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(request({ authorization: 'Bearer ' }))
    expect(res.status).toBe(401)
    expect(listSubscriptionsPage).not.toHaveBeenCalled()
  })

  it('accepts POST so an operator can force a run after a webhook outage', async () => {
    const res = await POST(authed())
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Pass A: Stripe -> local
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions drift correction', () => {
  it('makes no writes when the local row already agrees with Stripe', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot()],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow())

    const res = await GET(authed())
    const body = await res.json()

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(upsertSubscription).not.toHaveBeenCalled()
    expect(body.corrections).toBe(0)
    expect(body.stripe_subscriptions_examined).toBe(1)
  })

  it('treats an offset-formatted Postgres timestamp as equal to the same instant from Stripe', async () => {
    // The regression this guards: `2026-08-01T00:00:00+00:00` !== the Stripe ISO
    // `2026-08-01T00:00:00.000Z` as text, so a naive comparison would rewrite
    // every row on every run forever.
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot()],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow())

    await GET(authed())

    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('corrects a status the missed webhook never applied', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ status: 'past_due', stripeStatus: 'past_due' })],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow({ status: 'active' }))

    const res = await GET(authed())
    const body = await res.json()

    expect(updateSubscription).toHaveBeenCalledWith(
      { __admin: true },
      'sub_1',
      expect.objectContaining({ status: 'past_due' })
    )
    expect(body.drift_corrected).toBe(1)
  })

  it('corrects tier and period dates together and logs the correction', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [
        snapshot({ tier: 3, currentPeriodEnd: '2026-09-01T00:00:00.000Z' }),
      ],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow({ tier: 1 }))

    await GET(authed())

    expect(updateSubscription).toHaveBeenCalledWith(
      { __admin: true },
      'sub_1',
      expect.objectContaining({ tier: 3, current_period_end: '2026-09-01T00:00:00.000Z' })
    )
    expect(captureMessage).toHaveBeenCalledWith(
      'Reconciled a subscription against Stripe',
      'warning',
      expect.objectContaining({ kind: 'drift_corrected', stripe_subscription_id: 'sub_1' })
    )
  })

  it('is idempotent: the second run over corrected data changes nothing', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ status: 'past_due' })],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow({ status: 'active' }))
    await GET(authed())
    expect(updateSubscription).toHaveBeenCalledTimes(1)

    // Second run sees the already-corrected row.
    updateSubscription.mockClear()
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(localRow({ status: 'past_due' }))
    const res = await GET(authed())

    expect(updateSubscription).not.toHaveBeenCalled()
    expect((await res.json()).corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Pass A: the B-2 failure mode — money taken, no local row
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions missing local row', () => {
  it('creates the row from subscription metadata', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot()],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeSubscriptionId.mockResolvedValue(null)

    const res = await GET(authed())
    const body = await res.json()

    expect(upsertSubscription).toHaveBeenCalledWith(
      { __admin: true },
      expect.objectContaining({
        brand_id: BRAND,
        stripe_subscription_id: 'sub_1',
        stripe_customer_id: 'cus_1',
        tier: 2,
        status: 'active',
        current_period_start: '2026-07-01T00:00:00.000Z',
        current_period_end: '2026-08-01T00:00:00.000Z',
      })
    )
    expect(body.local_rows_created).toBe(1)
  })

  it('falls back to the brand already linked to the same Stripe customer', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ brandProfileId: null })],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeCustomerId.mockResolvedValue(localRow({ brand_id: 'brand-from-link' }))

    await GET(authed())

    expect(upsertSubscription).toHaveBeenCalledWith(
      { __admin: true },
      expect.objectContaining({ brand_id: 'brand-from-link' })
    )
  })

  it('never invents a brand_id: skips and logs when it cannot be resolved', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ brandProfileId: null })],
      hasMore: false,
      nextCursor: null,
    })
    getSubscriptionByStripeCustomerId.mockResolvedValue(null)

    const res = await GET(authed())
    const body = await res.json()

    expect(upsertSubscription).not.toHaveBeenCalled()
    expect(body.skipped).toBe(1)
    expect(captureMessage).toHaveBeenCalledWith(
      'Could not reconcile a Stripe subscription',
      'error',
      expect.objectContaining({ stripe_subscription_id: 'sub_1' })
    )
  })

  it('skips a subscription with no Stripe customer rather than writing a blank id', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ stripeCustomerId: null })],
      hasMore: false,
      nextCursor: null,
    })

    const body = await (await GET(authed())).json()

    expect(upsertSubscription).not.toHaveBeenCalled()
    expect(body.skipped).toBe(1)
  })

  it('skips a subscription with no billing period yet', async () => {
    listSubscriptionsPage.mockResolvedValue({
      subscriptions: [snapshot({ currentPeriodStart: null, currentPeriodEnd: null })],
      hasMore: false,
      nextCursor: null,
    })

    const body = await (await GET(authed())).json()

    expect(upsertSubscription).not.toHaveBeenCalled()
    expect(body.skipped).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Pass B: local -> Stripe
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions missing Stripe subscription', () => {
  it('marks a stale local row canceled when Stripe no longer has it', async () => {
    listStaleSubscriptions.mockResolvedValue([localRow({ status: 'active' })])
    retrieveSubscriptionSnapshot.mockResolvedValue(null)

    const res = await GET(authed())
    const body = await res.json()

    expect(retrieveSubscriptionSnapshot).toHaveBeenCalledWith('sub_1')
    expect(updateSubscription).toHaveBeenCalledWith(
      { __admin: true },
      'sub_1',
      expect.objectContaining({ status: 'canceled' })
    )
    expect(body.marked_canceled).toBe(1)
    expect(body.local_rows_examined).toBe(1)
  })

  it('preserves an existing canceled_at instead of overwriting it', async () => {
    listStaleSubscriptions.mockResolvedValue([
      localRow({ status: 'past_due', canceled_at: '2026-06-01T00:00:00+00:00' }),
    ])
    retrieveSubscriptionSnapshot.mockResolvedValue(null)

    await GET(authed())

    expect(updateSubscription).toHaveBeenCalledWith(
      { __admin: true },
      'sub_1',
      expect.objectContaining({ canceled_at: '2026-06-01T00:00:00+00:00' })
    )
  })

  it('only asks for rows that still grant access and are past their period', async () => {
    await GET(authed())
    expect(listStaleSubscriptions).toHaveBeenCalledWith(
      { __admin: true },
      expect.objectContaining({ limit: expect.any(Number), before: expect.any(String) })
    )
  })

  it('corrects drift instead of cancelling when Stripe still has the subscription', async () => {
    listStaleSubscriptions.mockResolvedValue([localRow({ status: 'active' })])
    retrieveSubscriptionSnapshot.mockResolvedValue(
      snapshot({ currentPeriodEnd: '2026-09-01T00:00:00.000Z' })
    )

    const body = await (await GET(authed())).json()

    expect(updateSubscription).toHaveBeenCalledWith(
      { __admin: true },
      'sub_1',
      expect.objectContaining({ current_period_end: '2026-09-01T00:00:00.000Z' })
    )
    expect(body.marked_canceled).toBe(0)
    expect(body.drift_corrected).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Pagination and bounding
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions pagination', () => {
  it('follows the cursor across pages and stops when Stripe says there are no more', async () => {
    listSubscriptionsPage
      .mockResolvedValueOnce({
        subscriptions: [snapshot({ stripeSubscriptionId: 'sub_a' })],
        hasMore: true,
        nextCursor: 'sub_a',
      })
      .mockResolvedValueOnce({
        subscriptions: [snapshot({ stripeSubscriptionId: 'sub_b' })],
        hasMore: false,
        nextCursor: 'sub_b',
      })

    const body = await (await GET(authed())).json()

    expect(listSubscriptionsPage).toHaveBeenCalledTimes(2)
    expect(listSubscriptionsPage).toHaveBeenNthCalledWith(1, { limit: 100 })
    expect(listSubscriptionsPage).toHaveBeenNthCalledWith(2, {
      limit: 100,
      startingAfter: 'sub_a',
    })
    expect(body.stripe_subscriptions_examined).toBe(2)
    expect(body.truncated).toBe(false)
  })

  it('stops at the page budget and reports the run as truncated', async () => {
    listSubscriptionsPage.mockImplementation(({ startingAfter }: { startingAfter?: string }) =>
      Promise.resolve({
        subscriptions: [snapshot({ stripeSubscriptionId: `sub_${startingAfter ?? 'first'}` })],
        hasMore: true,
        nextCursor: `sub_${startingAfter ?? 'first'}`,
      })
    )

    const body = await (await GET(authed())).json()

    // MAX_STRIPE_PAGES in the route.
    expect(listSubscriptionsPage).toHaveBeenCalledTimes(5)
    expect(body.truncated).toBe(true)
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('per-invocation page budget'),
      'warning',
      expect.anything()
    )
  })

  it('stops immediately on an empty first page', async () => {
    const body = await (await GET(authed())).json()
    expect(listSubscriptionsPage).toHaveBeenCalledTimes(1)
    expect(body.stripe_subscriptions_examined).toBe(0)
    expect(body.corrections).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

describe('reconcile-subscriptions failure handling', () => {
  it('returns 500 and reports the exception when Stripe is unreachable', async () => {
    listSubscriptionsPage.mockRejectedValue(new Error('Stripe timed out'))

    const res = await GET(authed())

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('RECONCILIATION_FAILED')
    expect(captureException).toHaveBeenCalled()
  })

  it('logs when CRON_SECRET is unset so a silently-never-running job is visible', async () => {
    delete process.env.CRON_SECRET
    await GET(request())
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('CRON_SECRET is not configured'),
      'error'
    )
  })
})
