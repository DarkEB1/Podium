import Stripe from 'stripe'
import { z } from 'zod'
import { serverEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Pinned explicitly so a Stripe-side default bump can never silently change
// payload shapes. This is `Stripe.LatestApiVersion` for stripe@17.7.0.
export const STRIPE_API_VERSION = '2025-02-24.acacia' as const

let _client: Stripe | undefined

function client(): Stripe {
  if (!_client) {
    _client = new Stripe(serverEnv().STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    })
  }
  return _client
}

/** The shared Stripe client, for other lib/stripe modules (e.g. Connect). */
export function stripeClient(): Stripe {
  return client()
}

// Stripe price IDs per subscription tier — validated via lib/env.
const TIER_PRICES: Record<1 | 2 | 3, () => string> = {
  1: () => serverEnv().STRIPE_PRICE_TIER_1,
  2: () => serverEnv().STRIPE_PRICE_TIER_2,
  3: () => serverEnv().STRIPE_PRICE_TIER_3,
}

// ---------------------------------------------------------------------------
// Metadata contract (B-2 / ST-5)
//
// The webhook is the reader and these builders are the only writers, so the
// keys can never drift. Stripe metadata values are always strings.
// ---------------------------------------------------------------------------

const subscriptionMetadataSchema = z.object({
  // brand_profiles.id — this is what subscriptions.brand_id references.
  brandProfileId: z.string().uuid(),
  // auth users.id of the brand user who started checkout (audit / fallback).
  userId: z.string().uuid(),
})

const paymentMetadataSchema = z.object({
  contractId: z.string().uuid(),
  // users.id — payments.payer_id / payments.payee_id both reference users.id.
  payerId: z.string().uuid(),
  payeeId: z.string().uuid(),
})

export type SubscriptionMetadata = z.infer<typeof subscriptionMetadataSchema>
export type PaymentMetadata = z.infer<typeof paymentMetadataSchema>

export function buildSubscriptionMetadata(meta: SubscriptionMetadata): Record<string, string> {
  return { brandProfileId: meta.brandProfileId, userId: meta.userId }
}

export function buildPaymentMetadata(meta: PaymentMetadata): Record<string, string> {
  return { contractId: meta.contractId, payerId: meta.payerId, payeeId: meta.payeeId }
}

/** Returns null (never throws) when metadata is absent or incomplete. */
export function parseSubscriptionMetadata(
  raw: Stripe.Metadata | null | undefined
): SubscriptionMetadata | null {
  const parsed = subscriptionMetadataSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : null
}

/** Returns null (never throws) when metadata is absent or incomplete. */
export function parsePaymentMetadata(
  raw: Stripe.Metadata | null | undefined
): PaymentMetadata | null {
  const parsed = paymentMetadataSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------
// Checkout / subscriptions
// ---------------------------------------------------------------------------

export async function createCheckoutSession(params: {
  /** brand_profiles.id — the value subscriptions.brand_id must hold. */
  brandProfileId: string
  /** auth users.id of the brand user. */
  userId: string
  tier: 1 | 2 | 3
  customerId?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const { brandProfileId, userId, tier, customerId, successUrl, cancelUrl } = params

  const metadata = buildSubscriptionMetadata({ brandProfileId, userId })

  const session = await client().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: TIER_PRICES[tier](), quantity: 1 }],
    // subscription_data.metadata is what lands on the SUBSCRIPTION object.
    // Session-level metadata does NOT propagate to the subscription — that
    // omission was the root cause of the empty brand_id FK violation (B-2).
    subscription_data: { trial_period_days: 7, metadata },
    metadata,
    client_reference_id: brandProfileId,
    ...(customerId ? { customer: customerId } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return { url: session.url!, sessionId: session.id }
}

export async function cancelSubscription(stripeSubscriptionId: string): Promise<void> {
  // update schedules cancellation at period end; cancel() would terminate immediately
  await client().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })
}

/** Used by the checkout.session.completed handler to hydrate the full row. */
export async function retrieveSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return client().subscriptions.retrieve(stripeSubscriptionId)
}

// ---------------------------------------------------------------------------
// Reconciliation support (ST-3 / ST-4 / ST-6)
//
// Webhooks get missed — endpoint down, event dropped, signing secret rotated —
// and when one is missed the local `subscriptions` row diverges from Stripe
// silently. The reconciliation job in app/api/cron/reconcile-subscriptions
// re-reads Stripe and repairs the difference. Everything it needs from Stripe
// lives here, because no module outside lib/stripe/ may call Stripe.
// ---------------------------------------------------------------------------

/**
 * Local `subscription_status` enum equivalent of a Stripe status.
 *
 * Stripe exposes statuses the enum does not have, so they are mapped onto the
 * closest truthful local value rather than writing an invalid enum. Kept
 * alongside the Stripe client so the webhook route and the reconciliation job
 * can never disagree about what "past_due" means.
 */
export type LocalSubscriptionStatus =
  Database['public']['Enums']['subscription_status']

const STATUS_MAP: Record<Stripe.Subscription.Status, LocalSubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'paused',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'canceled',
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): LocalSubscriptionStatus {
  return STATUS_MAP[status] ?? 'past_due'
}

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/**
 * Everything the local `subscriptions` row is derived from, already normalised.
 *
 * The job compares snapshots against rows; it never touches a raw Stripe object,
 * which keeps the Stripe SDK inside this module and keeps the comparison honest
 * (both sides are ISO strings and local enum values).
 */
export interface StripeSubscriptionSnapshot {
  stripeSubscriptionId: string
  /** null when Stripe has no customer on the subscription — never written as ''. */
  stripeCustomerId: string | null
  /** brand_profiles.id from subscription metadata, or null if absent. */
  brandProfileId: string | null
  status: LocalSubscriptionStatus
  /** Raw Stripe status, for logging a correction in Stripe's own vocabulary. */
  stripeStatus: Stripe.Subscription.Status
  tier: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  canceledAt: string | null
}

/** Tier lives on the price metadata; anything unparseable falls back to 1. */
function tierOf(sub: Stripe.Subscription): number {
  const raw = sub.items?.data?.[0]?.price?.metadata?.['tier']
  const tier = parseInt(raw ?? '1', 10)
  return Number.isNaN(tier) || tier < 1 || tier > 3 ? 1 : tier
}

export function toSubscriptionSnapshot(sub: Stripe.Subscription): StripeSubscriptionSnapshot {
  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: idOf(sub.customer),
    brandProfileId: parseSubscriptionMetadata(sub.metadata)?.brandProfileId ?? null,
    status: mapStripeSubscriptionStatus(sub.status),
    stripeStatus: sub.status,
    tier: tierOf(sub),
    currentPeriodStart: toIso(sub.current_period_start),
    currentPeriodEnd: toIso(sub.current_period_end),
    trialEndsAt: toIso(sub.trial_end),
    canceledAt: toIso(sub.canceled_at),
  }
}

/** Stripe's hard cap on `limit` for list endpoints. */
export const STRIPE_LIST_MAX_PAGE_SIZE = 100

export interface SubscriptionPage {
  subscriptions: StripeSubscriptionSnapshot[]
  /** True when Stripe has more pages after this one. */
  hasMore: boolean
  /** Cursor to pass back as `startingAfter`; null when the page was empty. */
  nextCursor: string | null
}

/**
 * One page of Stripe subscriptions, newest first, as normalised snapshots.
 *
 * Cursor-paginated rather than auto-paginated on purpose: the caller must be
 * able to stop after a fixed number of pages so a serverless invocation cannot
 * run past its time limit on an account with tens of thousands of subscriptions.
 *
 * `status: 'all'` is the default because a subscription that was cancelled while
 * the webhook was down is exactly the row that needs correcting, and the default
 * Stripe filter would hide it.
 */
export async function listSubscriptionsPage(params: {
  startingAfter?: string
  limit?: number
  status?: Stripe.SubscriptionListParams.Status
} = {}): Promise<SubscriptionPage> {
  const limit = Math.min(
    STRIPE_LIST_MAX_PAGE_SIZE,
    Math.max(1, params.limit ?? STRIPE_LIST_MAX_PAGE_SIZE)
  )

  const page = await client().subscriptions.list({
    limit,
    status: params.status ?? 'all',
    ...(params.startingAfter ? { starting_after: params.startingAfter } : {}),
  })

  const data = page.data ?? []

  return {
    subscriptions: data.map(toSubscriptionSnapshot),
    hasMore: page.has_more === true,
    nextCursor: data.length > 0 ? data[data.length - 1]!.id : null,
  }
}

/**
 * A single subscription as a snapshot, or null when Stripe does not have it.
 *
 * Used for the local-row-first direction: a local row is only declared gone when
 * Stripe answers "no such subscription" for that exact id. Absence from a
 * bounded page listing is NOT evidence of deletion, and treating it as such
 * would revoke access from paying brands.
 */
export async function retrieveSubscriptionSnapshot(
  stripeSubscriptionId: string
): Promise<StripeSubscriptionSnapshot | null> {
  try {
    return toSubscriptionSnapshot(await client().subscriptions.retrieve(stripeSubscriptionId))
  } catch (err) {
    if (isStripeResourceMissing(err)) return null
    throw err
  }
}

/** True for Stripe's "no such ..." 404, which is a fact, not a failure. */
export function isStripeResourceMissing(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  // Stripe errors are plain objects with `code`/`type`/`statusCode`; narrowing
  // via a structural type avoids `instanceof` against the mocked SDK in tests.
  const e = err as { code?: string; type?: string; statusCode?: number }
  return e.code === 'resource_missing' || (e.type === 'StripeInvalidRequestError' && e.statusCode === 404)
}

// ---------------------------------------------------------------------------
// Payment intents
// ---------------------------------------------------------------------------

/**
 * Convert a MAJOR-unit amount (`proposals.pay_amount`, e.g. 5000 meaning
 * £5,000) to the minor units Stripe bills in.
 *
 * ST-6: `proposals.pay_amount` is major units, documented at
 * `lib/supabase/guardian.ts` and rendered without division by every deal
 * surface, while `payments.amount` and Stripe's `amount` are minor units (the
 * webhook stores `pi.amount` and `lib/email/notify.ts formatAmount` divides by
 * 100). The intents route passed the major figure straight through, so every
 * deal was charged at 1/100th of the agreed value.
 *
 * Rounded, not truncated: 49.99 * 100 is 4998.999... in IEEE 754.
 */
export function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100)
}

export async function createPaymentIntent(params: {
  contractId: string
  /** users.id of the paying brand user. */
  payerId: string
  /** users.id of the athlete/team being paid. */
  payeeId: string
  /** Stripe's smallest currency unit. Convert with `toMinorUnits` at the call site. */
  amountMinor: number
  currency: string
  customerId: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { contractId, payerId, payeeId, amountMinor, currency, customerId } = params

  const intent = await client().paymentIntents.create(
    {
      amount: amountMinor,
      currency,
      customer: customerId,
      metadata: buildPaymentMetadata({ contractId, payerId, payeeId }),
    },
    { idempotencyKey: `pi_${contractId}` }
  )

  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id }
}

export type ChargeSettlement = {
  chargeId: string
  receiptUrl: string | null
  /** Stripe processing fee in the smallest currency unit, or null if unsettled. */
  stripeFee: number | null
  /** Amount credited to the platform balance, or null if unsettled. */
  netAmount: number | null
}

/**
 * Retrieves a charge with its balance transaction expanded.
 *
 * The PaymentIntent no longer carries a `charges` list on modern API versions,
 * so fee/net/receipt must be read from `pi.latest_charge` — see the webhook.
 */
export async function retrieveChargeSettlement(chargeId: string): Promise<ChargeSettlement> {
  const charge = await client().charges.retrieve(chargeId, {
    expand: ['balance_transaction'],
  })

  // balance_transaction is `string | BalanceTransaction | null`; the expand above
  // makes it an object, but it stays null until the charge settles.
  const balanceTx =
    charge.balance_transaction && typeof charge.balance_transaction === 'object'
      ? charge.balance_transaction
      : null

  return {
    chargeId: charge.id,
    receiptUrl: charge.receipt_url ?? null,
    stripeFee: balanceTx?.fee ?? null,
    netAmount: balanceTx?.net ?? null,
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
): Stripe.Event {
  return client().webhooks.constructEvent(body, signature, secret)
}
