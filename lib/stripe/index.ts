import Stripe from 'stripe'

let _client: Stripe | undefined

function client(): Stripe {
  if (!_client) {
    _client = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {})
  }
  return _client
}

// Stripe price IDs per subscription tier — set via environment variables
const TIER_PRICES: Record<1 | 2 | 3, () => string> = {
  1: () => process.env['STRIPE_PRICE_TIER_1'] ?? '',
  2: () => process.env['STRIPE_PRICE_TIER_2'] ?? '',
  3: () => process.env['STRIPE_PRICE_TIER_3'] ?? '',
}

export async function createCheckoutSession(params: {
  brandId: string
  tier: 1 | 2 | 3
  customerId?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const { brandId, tier, customerId, successUrl, cancelUrl } = params

  const session = await client().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: TIER_PRICES[tier](), quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    client_reference_id: brandId,
    ...(customerId ? { customer: customerId } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return { url: session.url!, sessionId: session.id }
}

export async function createPaymentIntent(params: {
  contractId: string
  amount: number
  currency: string
  customerId: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { contractId, amount, currency, customerId } = params

  const intent = await client().paymentIntents.create(
    {
      amount,
      currency,
      customer: customerId,
      metadata: { contractId },
    },
    { idempotencyKey: `pi_${contractId}` }
  )

  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id }
}

export async function cancelSubscription(stripeSubscriptionId: string): Promise<void> {
  // update schedules cancellation at period end; cancel() would terminate immediately
  await client().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })
}

export function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
): Stripe.Event {
  return client().webhooks.constructEvent(body, signature, secret)
}
