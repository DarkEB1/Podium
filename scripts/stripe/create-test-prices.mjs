// scripts/stripe/create-test-prices.mjs
// One-time: creates test-mode GBP monthly prices for the three tiers, each with metadata.tier.
// Run: node --env-file=.env.local scripts/stripe/create-test-prices.mjs
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key || !key.startsWith('sk_test_')) {
  console.error('Refusing: STRIPE_SECRET_KEY must be a TEST key (sk_test_...). No live-mode objects.')
  process.exit(1)
}
const stripe = new Stripe(key)
const product = await stripe.products.create({ name: 'Podium Subscription' })
const defs = [
  { tier: '1', name: 'Starter', amount: 5900 },
  { tier: '2', name: 'Growth', amount: 14900 },
  { tier: '3', name: 'Enterprise', amount: 29900 },
]
for (const d of defs) {
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'gbp',
    unit_amount: d.amount,
    recurring: { interval: 'month' },
    nickname: `Podium ${d.name} (GBP ${d.amount / 100}/mo)`,
    metadata: { tier: d.tier },
  })
  console.log(`STRIPE_PRICE_TIER_${d.tier}=${price.id}`)
}
