import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  upsertSubscription,
  updateSubscription,
  createPaymentRecord,
  updatePaymentRecord,
} from '@/lib/supabase/payments'
import { constructWebhookEvent } from '@/lib/stripe'
import type Stripe from 'stripe'

// Stripe sends the raw body — must not parse as JSON
export const dynamic = 'force-dynamic'

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Subscription event handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(
  event: Stripe.CustomerSubscriptionCreatedEvent,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const sub = event.data.object
  const tier = parseInt(
    (sub.items.data[0]?.price?.metadata?.['tier'] as string | undefined) ?? '1',
    10
  )

  await upsertSubscription(adminSupabase, {
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    tier: isNaN(tier) ? 1 : tier,
    status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused',
    current_period_start: toIso(sub.current_period_start)!,
    current_period_end: toIso(sub.current_period_end)!,
    trial_ends_at: toIso(sub.trial_end),
    canceled_at: toIso(sub.canceled_at),
    // brand_id will be set when brand profile is linked via Stripe customer metadata
    // The client_reference_id from checkout carries the user's id; brand profile lookup happens
    // via stripe_customer_id matching in getSubscriptionForUser
    brand_id: (sub.metadata?.['brandProfileId'] as string | undefined) ?? '',
  })
}

async function handleSubscriptionUpdated(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const sub = event.data.object
  const tier = parseInt(
    (sub.items.data[0]?.price?.metadata?.['tier'] as string | undefined) ?? '1',
    10
  )

  const updateData: Parameters<typeof updateSubscription>[2] = {
    status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused',
    trial_ends_at: toIso(sub.trial_end),
    canceled_at: toIso(sub.canceled_at),
  }
  if (!isNaN(tier)) updateData.tier = tier
  const periodStart = toIso(sub.current_period_start)
  const periodEnd = toIso(sub.current_period_end)
  if (periodStart) updateData.current_period_start = periodStart
  if (periodEnd) updateData.current_period_end = periodEnd

  await updateSubscription(adminSupabase, sub.id, updateData)
}

// ---------------------------------------------------------------------------
// Payment intent event handlers
// ---------------------------------------------------------------------------

async function handlePaymentIntentCreated(
  event: Stripe.PaymentIntentCreatedEvent,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const pi = event.data.object
  const contractId = pi.metadata?.['contractId']

  // Only track payment intents created for Podium deal payments
  if (!contractId) return

  await createPaymentRecord(adminSupabase, {
    stripe_payment_intent_id: pi.id,
    contract_id: contractId,
    // payer_id and payee_id must come from metadata set during intent creation
    payer_id: (pi.metadata?.['payerId'] as string | undefined) ?? '',
    payee_id: (pi.metadata?.['payeeId'] as string | undefined) ?? '',
    amount: pi.amount,
    currency: (pi.currency ?? 'gbp').toUpperCase(),
    status: 'pending',
  })
}

async function handlePaymentIntentSucceeded(
  event: Stripe.PaymentIntentSucceededEvent,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const pi = event.data.object
  // Stripe SDK v17 exposes charges via the expandable charges list
  const piAny = pi as unknown as { charges?: { data: Array<{ balance_transaction?: { fee: number; net: number } | null; receipt_url?: string | null }> } }
  const charge = piAny.charges?.data[0]
  const balanceTx = charge?.balance_transaction ?? null

  await updatePaymentRecord(adminSupabase, pi.id, {
    status: 'succeeded',
    processed_at: new Date().toISOString(),
    stripe_fee: balanceTx?.fee ?? null,
    net_amount: balanceTx?.net ?? null,
    platform_fee: null,
    receipt_url: charge?.receipt_url ?? null,
  })
}

async function handlePaymentIntentFailed(
  event: Stripe.PaymentIntentPaymentFailedEvent,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const pi = event.data.object
  await updatePaymentRecord(adminSupabase, pi.id, { status: 'failed' })
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
  const secret = process.env['STRIPE_WEBHOOK_SECRET'] ?? ''

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

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(
        event as Stripe.CustomerSubscriptionCreatedEvent,
        adminSupabase
      )
      break
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionUpdated(
        event as Stripe.CustomerSubscriptionUpdatedEvent,
        adminSupabase
      )
      break
    case 'payment_intent.created':
      await handlePaymentIntentCreated(
        event as Stripe.PaymentIntentCreatedEvent,
        adminSupabase
      )
      break
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(
        event as Stripe.PaymentIntentSucceededEvent,
        adminSupabase
      )
      break
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(
        event as Stripe.PaymentIntentPaymentFailedEvent,
        adminSupabase
      )
      break
    default:
      // Unknown events are acknowledged without processing
      break
  }

  return NextResponse.json({ received: true })
}
