// scripts/stripe/create-test-prices.mjs
// Creates test-mode GBP monthly prices for the three tiers, each with metadata.tier.
// Amounts and names come from lib/entitlements (the single source of truth), so
// re-run this whenever the tiers change and paste the printed ids into
// STRIPE_PRICE_TIER_1/2/3 (.env.local + Vercel Preview). Live-mode prices are
// created by hand per docs/stripe-live-price-checklist.md.
// Run: node --env-file=.env.local scripts/stripe/create-test-prices.mjs
import Stripe from 'stripe'
import { readFileSync } from 'node:fs'

const key = process.env.STRIPE_SECRET_KEY
if (!key || !key.startsWith('sk_test_')) {
  console.error('Refusing: STRIPE_SECRET_KEY must be a TEST key (sk_test_...). No live-mode objects.')
  process.exit(1)
}

// Read the config without a TS toolchain: the two records are plain literals.
const src = readFileSync(new URL('../../lib/entitlements/index.ts', import.meta.url), 'utf8')
const names = Object.fromEntries(
  [...src.match(/TIER_NAMES[^=]*=\s*\{([^}]*)\}/)[1].matchAll(/(\d):\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
)
const prices = Object.fromEntries(
  [...src.match(/TIER_PRICE_GBP[^=]*=\s*\{([^}]*)\}/)[1].matchAll(/(\d):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])])
)
const defs = ['1', '2', '3'].map((tier) => ({
  tier,
  name: names[tier],
  amount: Math.round(prices[tier] * 100),
}))
if (defs.some((d) => !d.name || !Number.isInteger(d.amount) || d.amount <= 0)) {
  console.error('Could not parse TIER_NAMES / TIER_PRICE_GBP from lib/entitlements/index.ts', defs)
  process.exit(1)
}

const stripe = new Stripe(key)
const product = await stripe.products.create({ name: 'Podium Subscription' })
for (const d of defs) {
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'gbp',
    unit_amount: d.amount,
    recurring: { interval: 'month' },
    nickname: `Podium ${d.name} (GBP ${(d.amount / 100).toFixed(2)}/mo)`,
    metadata: { tier: d.tier },
  })
  console.log(`STRIPE_PRICE_TIER_${d.tier}=${price.id}`)
}
