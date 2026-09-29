# Going live with Stripe (manual, Nicholas only)

Agents never create live-mode Stripe objects, enter live API keys or bank details, or
change Production env vars. This is the full "switch out of test mode" runbook.

**Decision 2026-09-15: Connect is dropped in favour of the P2P/direct-payment model
(`feat/esign-p2p-payment`).** No Connect setup and no second webhook here; this covers
subscription billing only.

**Pricing change 2026-09-29:** tiers are now Starter £49 / Growth £99.99 / Unlimited £129
(was £59 / £149 / £299 with "Enterprise"). The amounts live in `lib/entitlements/index.ts`.
The three live prices created earlier at the OLD amounts must NOT be used; create new ones
(step 2) and archive the old ones once nothing references them.

Everything is in **LIVE mode** on account `acct_1U00dtRuiS086Bui` ("Podium").
Production Vercel project: `podium` (team `podium6`).

## 1. Activate the live account: DONE
Business details and bank account complete; live payments enabled.

## 2. Create the three live prices at the NEW amounts
Dashboard (LIVE mode) > Product catalogue > "Podium Subscription" (or a new product) >
add a recurring GBP monthly price for each tier. Each price MUST carry the metadata key
`tier`; the webhook reads `price.metadata.tier` to assign the plan.

| Tier | Name      | Amount      | metadata.tier |
|------|-----------|-------------|---------------|
| 1    | Starter   | £49.00 /mo  | `1`           |
| 2    | Growth    | £99.99 /mo  | `2`           |
| 3    | Unlimited | £129.00 /mo | `3`           |

Copy each live price id (`price_...`). Then archive the superseded live prices
(£59 `price_1UFrvyRuiS086BuiI4ZGaAZf`, £149 `price_1UFrwVRuiS086Bui8IuX6VUe`,
£299 `price_1UFrwkRuiS086Bui4qrWNOv0`) so nobody picks them by mistake. Archiving does not
affect any subscription already on them.

Test-mode equivalents (already created 2026-09-29, set in `.env.local` and Vercel Preview):
`price_1UL4ZfRuiS086BuiGQqKu1oh` / `price_1UL4ZfRuiS086Bui5CvMYzNA` / `price_1UL4ZfRuiS086Buij6wUZuks`.
Re-create test prices any time with `node --env-file=.env.local scripts/stripe/create-test-prices.mjs`
(it reads the amounts from `lib/entitlements/index.ts`).

## 3. Create the live webhook endpoint
Dashboard > Developers > Webhooks (LIVE) > Add endpoint.
URL: `https://www.podiumsponsorship.com/api/webhooks/stripe`
Events:
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_succeeded`, `invoice.payment_failed`,
`payment_intent.created`, `payment_intent.succeeded`, `payment_intent.processing`,
`payment_intent.payment_failed`, `payment_intent.canceled`,
`charge.succeeded`, `charge.refunded`
Copy the **Signing secret** (`whsec_...`).

## 4. Set Production env vars
Vercel > Project `podium` > Settings > Environment Variables > **Production**:
- `STRIPE_SECRET_KEY` = `sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
- `STRIPE_WEBHOOK_SECRET` = the signing secret from step 3
- `STRIPE_PRICE_TIER_1` = live Starter price id (£49)
- `STRIPE_PRICE_TIER_2` = live Growth price id (£99.99)
- `STRIPE_PRICE_TIER_3` = live Unlimited price id (£129)
(No `STRIPE_CONNECT_WEBHOOK_SECRET`; Connect is dropped.)

Until the live switch happens, Production should at least point at the NEW test-mode price
ids above, otherwise the pricing page says £49 while checkout charges the old £59 test price.

## 5. Redeploy production
Redeploy so the new env vars take effect. Existing test-mode subscriptions do NOT carry over.

## 6. Verify with a real transaction
- Confirm production checkout works FIRST (there was an open "checkout broken" issue).
- Subscribe with a real card, confirm the plan applies (webhook wrote it), then refund.
- Dashboard > Webhooks: endpoint showing 2xx, no signature failures.

## Rollback
Restore the test env values and redeploy.
