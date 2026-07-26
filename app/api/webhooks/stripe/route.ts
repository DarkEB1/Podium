import { NextRequest, NextResponse } from 'next/server'
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
  parseSubscriptionMetadata,
  parsePaymentMetadata,
  retrieveChargeSettlement,
  retrieveSubscription,
} from '@/lib/stripe'
import { sendTransactionalEmail } from '@/lib/email'
import {
  absoluteUrl,
  formatAmount,
  nameOf,
  resolveDisplayNames,
  tierName,
  FALLBACK_OTHER_NAME,
} from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'
import { serverEnv } from '@/lib/env'
import type { Database } from '@/types/database'
import type Stripe from 'stripe'

// Stripe sends the raw body — must not parse as JSON
export const dynamic = 'force-dynamic'

type AdminClient = ReturnType<typeof createAdminClient>
type SubscriptionStatus = Database['public']['Enums']['subscription_status']

/**
 * Handler result.
 * - `processed`     → handled (or deliberately ignored); respond 200.
 * - `unprocessable` → the event can never succeed (missing/incoherent data).
 *                     Record why and respond 200 so Stripe stops retrying.
 * Transient failures are signalled by throwing; see `classifyFailure`.
 */
type HandlerOutcome = { status: 'processed' } | { status: 'unprocessable'; reason: string }

const PROCESSED: HandlerOutcome = { status: 'processed' }
const unprocessable = (reason: string): HandlerOutcome => ({ status: 'unprocessable', reason })

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}

// Stripe exposes statuses our subscription_status enum does not have; map them
// onto the closest truthful local value rather than writing an invalid enum.
const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'paused',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'canceled',
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  return STATUS_MAP[status] ?? 'past_due'
}

function tierOf(sub: Stripe.Subscription): number {
  const raw = sub.items.data[0]?.price?.metadata?.['tier']
  const tier = parseInt(raw ?? '1', 10)
  return Number.isNaN(tier) || tier < 1 || tier > 3 ? 1 : tier
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

// ---------------------------------------------------------------------------
// brand_id resolution (B-2)
//
// subscriptions.brand_id references brand_profiles.id. Resolve it defensively:
//   1. subscription metadata written by buildSubscriptionMetadata (authoritative)
//   2. an existing subscription row already linked to this Stripe customer
// If neither works we must NOT insert a row with an empty brand_id — that is a
// guaranteed FK violation.
// ---------------------------------------------------------------------------

async function resolveBrandProfileId(
  sub: Stripe.Subscription,
  admin: AdminClient
): Promise<string | null> {
  const fromMetadata = parseSubscriptionMetadata(sub.metadata)
  if (fromMetadata) return fromMetadata.brandProfileId

  const customerId = idOf(sub.customer)
  if (customerId) {
    const existing = await getSubscriptionByStripeCustomerId(admin, customerId)
    if (existing?.brand_id) return existing.brand_id
  }

  return null
}

// Idempotent by construction: upsertSubscription conflicts on brand_id and every
// column written is an absolute value read from Stripe, so replaying the same
// event produces the same row.
async function upsertFromStripeSubscription(
  sub: Stripe.Subscription,
  brandProfileId: string,
  admin: AdminClient
): Promise<HandlerOutcome> {
  // stripe_customer_id is `text not null` with no FK, so a placeholder `''`
  // inserts silently and then makes the customer-id fallback resolver ambiguous.
  // Treat an unresolvable customer exactly like an unresolvable brand_id: record
  // why and insert nothing.
  const customerId = idOf(sub.customer)
  if (!customerId) {
    return unprocessable(`subscription ${sub.id} carries no Stripe customer id`)
  }

  await upsertSubscription(admin, {
    brand_id: brandProfileId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    tier: tierOf(sub),
    status: mapStatus(sub.status),
    current_period_start: toIso(sub.current_period_start)!,
    current_period_end: toIso(sub.current_period_end)!,
    trial_ends_at: toIso(sub.trial_end),
    canceled_at: toIso(sub.canceled_at),
  })

  // Side effect after the subscription row is durably written: welcome the brand
  // user. The recipient is the auth user id, which only the subscription
  // metadata carries (brandProfileId is a brand_profiles.id, not a user id); if
  // the brand was resolved by the customer-link fallback there is no userId to
  // email, so skip. Idempotent per subscription: checkout.session.completed and
  // customer.subscription.created both land here for the same subscription, and
  // the idempotencyKey collapses the second send to a no-op.
  const brandUserId = parseSubscriptionMetadata(sub.metadata)?.userId ?? null
  if (brandUserId) {
    const names = await resolveDisplayNames(admin, [brandUserId])
    await sendTransactionalEmail(admin, {
      event: 'subscription_started',
      userId: brandUserId,
      idempotencyKey: `subscription_started:${sub.id}`,
      data: {
        recipientName: nameOf(names, brandUserId),
        tierName: tierName(tierOf(sub)),
        url: absoluteUrl(ROUTES.brand.subscription),
      },
    })
  }

  return PROCESSED
}

// ---------------------------------------------------------------------------
// Subscription lifecycle handlers
// ---------------------------------------------------------------------------

// checkout.session.completed is the most reliable place to link the Stripe
// customer + subscription to the brand profile: client_reference_id is set by
// createCheckoutSession and always present.
async function handleCheckoutSessionCompleted(
  event: Stripe.CheckoutSessionCompletedEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const session = event.data.object

  if (session.mode !== 'subscription') return PROCESSED

  const subscriptionId = idOf(session.subscription)
  if (!subscriptionId) {
    return unprocessable('checkout session has no subscription id')
  }

  const brandProfileId =
    parseSubscriptionMetadata(session.metadata)?.brandProfileId ?? session.client_reference_id

  if (!brandProfileId) {
    return unprocessable('checkout session carries neither metadata.brandProfileId nor client_reference_id')
  }

  const sub = await retrieveSubscription(subscriptionId)
  return upsertFromStripeSubscription(sub, brandProfileId, admin)
}

async function handleSubscriptionCreated(
  event: Stripe.CustomerSubscriptionCreatedEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const sub = event.data.object
  const brandProfileId = await resolveBrandProfileId(sub, admin)

  if (!brandProfileId) {
    // Do not insert a broken row. checkout.session.completed normally arrives
    // and links this subscription; this event is then safely redundant.
    return unprocessable(
      `cannot resolve brand_profiles.id for subscription ${sub.id} (no metadata.brandProfileId, no linked customer)`
    )
  }

  return upsertFromStripeSubscription(sub, brandProfileId, admin)
}

// Idempotent: every field written is an absolute value from the Stripe object.
async function handleSubscriptionUpdated(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const sub = event.data.object

  const updateData: Parameters<typeof updateSubscription>[2] = {
    status: mapStatus(sub.status),
    trial_ends_at: toIso(sub.trial_end),
    canceled_at: toIso(sub.canceled_at),
    tier: tierOf(sub),
  }
  const periodStart = toIso(sub.current_period_start)
  const periodEnd = toIso(sub.current_period_end)
  if (periodStart) updateData.current_period_start = periodStart
  if (periodEnd) updateData.current_period_end = periodEnd

  await updateSubscription(admin, sub.id, updateData)
  return PROCESSED
}

// invoice.payment_succeeded / invoice.payment_failed keep status and period
// dates truthful across renewals (ST-3 / ST-4 / ST-6). The subscription object
// is re-read so the period dates are Stripe's authoritative values.
async function handleInvoicePayment(
  event: Stripe.InvoicePaymentSucceededEvent | Stripe.InvoicePaymentFailedEvent,
  admin: AdminClient,
  succeeded: boolean
): Promise<HandlerOutcome> {
  const invoice = event.data.object
  const subscriptionId = idOf(invoice.subscription)

  // One-off invoices are not subscription lifecycle events.
  if (!subscriptionId) return PROCESSED

  const sub = await retrieveSubscription(subscriptionId)

  const updateData: Parameters<typeof updateSubscription>[2] = {
    // On failure Stripe moves the subscription to past_due/unpaid itself, but
    // the mapped Stripe status is still the source of truth for both outcomes.
    status: succeeded ? mapStatus(sub.status) : mapStatus(sub.status === 'active' ? 'past_due' : sub.status),
    canceled_at: toIso(sub.canceled_at),
    trial_ends_at: toIso(sub.trial_end),
  }
  const periodStart = toIso(sub.current_period_start)
  const periodEnd = toIso(sub.current_period_end)
  if (periodStart) updateData.current_period_start = periodStart
  if (periodEnd) updateData.current_period_end = periodEnd

  await updateSubscription(admin, subscriptionId, updateData)

  // On a failed renewal, tell the brand user their subscription payment failed
  // so they can update their card. Recipient user id comes from the subscription
  // metadata (see subscription_started). Keyed on the invoice id so each failed
  // invoice emails exactly once, even across Stripe redeliveries.
  if (!succeeded) {
    const brandUserId = parseSubscriptionMetadata(sub.metadata)?.userId ?? null
    if (brandUserId) {
      const names = await resolveDisplayNames(admin, [brandUserId])
      await sendTransactionalEmail(admin, {
        event: 'subscription_payment_failed',
        userId: brandUserId,
        idempotencyKey: `subscription_payment_failed:${invoice.id}`,
        data: {
          recipientName: nameOf(names, brandUserId),
          url: absoluteUrl(ROUTES.brand.subscription),
        },
      })
    }
  }

  return PROCESSED
}

// ---------------------------------------------------------------------------
// Payment intent / charge handlers
// ---------------------------------------------------------------------------

async function handlePaymentIntentCreated(
  event: Stripe.PaymentIntentCreatedEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const pi = event.data.object

  // Only track payment intents created for Podium deal payments.
  if (!pi.metadata?.['contractId']) return PROCESSED

  const meta = parsePaymentMetadata(pi.metadata)
  if (!meta) {
    // payer_id / payee_id are NOT NULL FKs to users.id — an incomplete metadata
    // set can only ever produce an invalid row (ST-5).
    return unprocessable(
      `payment intent ${pi.id} metadata is incomplete (need contractId, payerId, payeeId)`
    )
  }

  // The /api/payments/intents route already inserts the row synchronously;
  // this webhook must not create a duplicate. This existence check is also what
  // makes the handler idempotent under replay — no extra guard needed.
  const existing = await getPaymentByIntentId(admin, pi.id)
  if (existing) return PROCESSED

  await createPaymentRecord(admin, {
    stripe_payment_intent_id: pi.id,
    contract_id: meta.contractId,
    payer_id: meta.payerId,
    payee_id: meta.payeeId,
    amount: pi.amount,
    currency: (pi.currency ?? 'gbp').toUpperCase(),
    status: 'pending',
  })

  return PROCESSED
}

// Writes the settled fee/net/receipt for a payment intent. Shared by
// payment_intent.succeeded and charge.succeeded.
//
// NOT naturally idempotent — `processed_at` is `new Date()`, so a replay used to
// rewrite the settlement time (and payment_intent.succeeded + charge.succeeded
// legitimately both land for the same payment). The already-settled guard below
// makes a replay a no-op, which is the real defence against a status write that
// fails after the handler succeeded.
async function settlePayment(
  paymentIntentId: string,
  chargeId: string | null,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const existing = await getPaymentByIntentId(admin, paymentIntentId)
  if (!existing) {
    return unprocessable(`no payments row for payment intent ${paymentIntentId}`)
  }

  if (existing.status === 'succeeded' && existing.processed_at) {
    return PROCESSED
  }

  // Stripe API 2025-02-24 does not expand `charges` on the PaymentIntent, so
  // fee/net/receipt must come from the charge + its balance transaction.
  const settlement = chargeId ? await retrieveChargeSettlement(chargeId) : null

  await updatePaymentRecord(admin, paymentIntentId, {
    status: 'succeeded',
    processed_at: new Date().toISOString(),
    stripe_fee: settlement?.stripeFee ?? null,
    net_amount: settlement?.netAmount ?? null,
    platform_fee: null,
    receipt_url: settlement?.receiptUrl ?? null,
  })

  // Side effect after the payment settles: email the PAYEE their receipt. The
  // already-settled guard above means this runs once per payment even though
  // payment_intent.succeeded and charge.succeeded both settle it; the
  // idempotencyKey on the intent id is the second line of defence against a
  // redelivery double-send. Amount is Stripe minor units; format for the body.
  if (existing.payee_id) {
    const names = await resolveDisplayNames(admin, [existing.payee_id, existing.payer_id])
    await sendTransactionalEmail(admin, {
      event: 'payment_received',
      userId: existing.payee_id,
      idempotencyKey: `payment_received:${paymentIntentId}`,
      data: {
        recipientName: nameOf(names, existing.payee_id),
        amountFormatted: formatAmount(existing.amount, existing.currency),
        fromName: nameOf(names, existing.payer_id, FALLBACK_OTHER_NAME),
        url: absoluteUrl(ROUTES.dashboard),
      },
    })
  }

  return PROCESSED
}

async function handlePaymentIntentSucceeded(
  event: Stripe.PaymentIntentSucceededEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const pi = event.data.object
  if (!pi.metadata?.['contractId']) return PROCESSED
  return settlePayment(pi.id, idOf(pi.latest_charge), admin)
}

async function handleChargeSucceeded(
  event: Stripe.ChargeSucceededEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const charge = event.data.object
  const paymentIntentId = idOf(charge.payment_intent)

  // Charges outside the deal-payment flow are not tracked.
  if (!paymentIntentId || !charge.metadata?.['contractId']) return PROCESSED

  return settlePayment(paymentIntentId, charge.id, admin)
}

async function handlePaymentIntentFailed(
  event: Stripe.PaymentIntentPaymentFailedEvent,
  admin: AdminClient
): Promise<HandlerOutcome> {
  const pi = event.data.object
  if (!pi.metadata?.['contractId']) return PROCESSED

  const existing = await getPaymentByIntentId(admin, pi.id)
  if (!existing) return unprocessable(`no payments row for payment intent ${pi.id}`)

  // Idempotent, and order-safe: a replayed (or late) failure event must never
  // downgrade a payment that has already settled.
  if (existing.status === 'succeeded') return PROCESSED

  await updatePaymentRecord(admin, pi.id, { status: 'failed' })
  return PROCESSED
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function dispatch(event: Stripe.Event, admin: AdminClient): Promise<HandlerOutcome> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event, admin)
    case 'customer.subscription.created':
      return handleSubscriptionCreated(event, admin)
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionUpdated(event, admin)
    case 'invoice.payment_succeeded':
      return handleInvoicePayment(event, admin, true)
    case 'invoice.payment_failed':
      return handleInvoicePayment(event, admin, false)
    case 'payment_intent.created':
      return handlePaymentIntentCreated(event, admin)
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event, admin)
    case 'charge.succeeded':
      return handleChargeSucceeded(event, admin)
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event, admin)
    default:
      // Unsubscribed event types are acknowledged without processing.
      return PROCESSED
  }
}

// ---------------------------------------------------------------------------
// Failure classification
//
// The default is TRANSIENT (500 → Stripe retries with its own backoff, and no
// terminal status is written). Getting this backwards loses money: an
// unrecognised error — a TypeError, an undici `fetch failed`, an AggregateError
// from a DNS lookup — used to be recorded as terminal and answered 200, so
// Stripe never retried AND every later redelivery short-circuited on the
// idempotency check. A paid subscription vanished permanently from one blip.
//
// An event is only classified `unprocessable` when it can be POSITIVELY
// identified as unfixable by retrying. The complete list:
//
//   1. PaymentsError with a code in UNPROCESSABLE_PAYMENTS_CODES — a referenced
//      entity genuinely does not exist. Retrying re-reads the same absent row.
//   2. Stripe errors whose code is `resource_missing` — the object the event
//      refers to is gone from Stripe itself.
//   3. Stripe's `StripeInvalidRequestError` — we built a request Stripe rejects
//      as malformed; identical retries produce identical rejections.
//   4. ZodError — metadata failed schema validation. The payload is fixed for
//      the lifetime of the event, so it will fail identically forever.
//
// Everything else, including anything unrecognised, is transient.
// ---------------------------------------------------------------------------

const UNPROCESSABLE_PAYMENTS_CODES = new Set([
  'SUBSCRIPTION_NOT_FOUND',
  'PAYMENT_NOT_FOUND',
  'CONTRACT_NOT_FOUND',
])

const UNPROCESSABLE_STRIPE_CODES = new Set(['resource_missing'])

/** Stripe SDK errors carry a machine-readable `code`; plain Errors do not. */
function stripeErrorCode(err: unknown): string | null {
  if (!(err instanceof Error) || !err.name.startsWith('Stripe')) return null
  // as Error & { code?: unknown }: `code` is not on the Error interface, and the
  // Stripe error classes are not imported here (no Stripe SDK use outside lib/stripe).
  const code = (err as Error & { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function classifyFailure(err: unknown): 'transient' | 'unprocessable' {
  // (1) Known-unrecoverable database outcomes. Every other PaymentsError
  // (fetch/insert/update failures) is a database problem worth retrying.
  if (err instanceof PaymentsError) {
    return UNPROCESSABLE_PAYMENTS_CODES.has(err.code) ? 'unprocessable' : 'transient'
  }

  if (err instanceof Error) {
    // (2) + (3) Stripe rejected the request itself, not the connection.
    const code = stripeErrorCode(err)
    if (code !== null && UNPROCESSABLE_STRIPE_CODES.has(code)) return 'unprocessable'
    if (err.name === 'StripeInvalidRequestError') return 'unprocessable'

    // (4) Schema validation of an immutable payload.
    if (err.name === 'ZodError') return 'unprocessable'
  }

  // Default: unknown failure modes are assumed retryable. Losing an event is
  // strictly worse than retrying one; MAX_DELIVERY_ATTEMPTS bounds the retries.
  return 'transient'
}

// Poison-event cap. Because unknown errors now retry, an event that fails on
// every delivery must still stop eventually. Stripe itself gives up after ~3
// days / ~15 attempts with exponential backoff; this cap is deliberately lower
// so the log records a decision rather than Stripe silently exhausting. The
// count comes from stripe_webhook_events.attempts, incremented atomically by
// claim_stripe_webhook_event, so it survives across serverless invocations.
const MAX_DELIVERY_ATTEMPTS = 8

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: { code: 'MISSING_SIGNATURE', message: 'stripe-signature header is required' } },
      { status: 400 }
    )
  }

  const body = await request.text()

  let secret: string
  try {
    secret = serverEnv().STRIPE_WEBHOOK_SECRET
  } catch (err) {
    // Misconfiguration, not a bad request — never silently accept unverified events.
    return NextResponse.json(
      { error: { code: 'WEBHOOK_NOT_CONFIGURED', message: messageOf(err) } },
      { status: 500 }
    )
  }

  // HMAC verification happens before any processing.
  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature, secret)
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  // --- Idempotency: Stripe retries the same event id for up to 3 days --------
  //
  // Claiming is a single atomic statement (see claimWebhookEvent). The previous
  // read-then-upsert pair left a window in which two concurrent deliveries of
  // the same event id could both pass the "not processed yet" check and both run
  // the handlers.
  let claim: Awaited<ReturnType<typeof claimWebhookEvent>>
  try {
    claim = await claimWebhookEvent(adminSupabase, {
      id: event.id,
      type: event.type,
      payload: event,
    })
  } catch (err) {
    // The event log itself is unavailable — genuinely transient. Ask for a retry
    // rather than processing an event we cannot record.
    return NextResponse.json(
      { error: { code: 'EVENT_LOG_UNAVAILABLE', message: messageOf(err) } },
      { status: 500 }
    )
  }

  if (!claim.claimed) {
    // Either the event already reached a terminal status, or another worker is
    // holding it right now. Either way this delivery must not run the handlers;
    // 200 because the event is (or is being) accounted for.
    return NextResponse.json({ received: true, duplicate: true })
  }

  // --- Poison-event guard: a handler failure never becomes an infinite retry --
  try {
    const outcome = await dispatch(event, adminSupabase)

    if (outcome.status === 'unprocessable') {
      console.warn(`[stripe-webhook] ${event.type} ${event.id} unprocessable: ${outcome.reason}`)
      await markWebhookEvent(adminSupabase, event.id, 'unprocessable', outcome.reason)
      return NextResponse.json({ received: true, processed: false, reason: outcome.reason })
    }

    // If THIS write fails the handlers have already run, so the catch below
    // returns 500 and Stripe replays the event. That replay is safe because
    // every handler is idempotent: upsertFromStripeSubscription and
    // handleSubscriptionUpdated/handleInvoicePayment write absolute values from
    // Stripe, handlePaymentIntentCreated is guarded by its existence check, and
    // settlePayment / handlePaymentIntentFailed carry explicit already-settled
    // guards. A status write can always fail; idempotent handlers are the only
    // real defence.
    await markWebhookEvent(adminSupabase, event.id, 'processed')
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = messageOf(err)
    const kind = classifyFailure(err)

    // A transient failure normally means "retry", but not forever: once the
    // attempt budget is spent the event is parked as unprocessable so it stops
    // consuming deliveries. `failed` is a non-terminal status — the next
    // delivery can re-claim it — so nothing is lost before the cap.
    const budgetSpent = kind === 'transient' && claim.attempts >= MAX_DELIVERY_ATTEMPTS
    const giveUp = kind === 'unprocessable' || budgetSpent
    const reason = budgetSpent
      ? `giving up after ${claim.attempts} attempts: ${message}`
      : message

    console.error(
      `[stripe-webhook] ${event.type} ${event.id} ${kind} failure ` +
        `(attempt ${claim.attempts}): ${message}`
    )

    // Best-effort: never let the bookkeeping write mask the original failure.
    try {
      await markWebhookEvent(
        adminSupabase,
        event.id,
        giveUp ? 'unprocessable' : 'failed',
        reason
      )
    } catch {
      /* ignored — status classification below is what drives Stripe's retry */
    }

    if (!giveUp) {
      return NextResponse.json(
        { error: { code: 'HANDLER_FAILED', message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ received: true, processed: false, reason })
  }
}
