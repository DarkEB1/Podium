# Stripe webhooks

Endpoint: `POST /api/webhooks/stripe` — `app/api/webhooks/stripe/route.ts`

All Stripe API access lives in `lib/stripe/`; all database access lives in
`lib/supabase/payments.ts`. The route handler contains no Stripe or Supabase
calls of its own.

---

## Request pipeline

1. **HMAC verification first.** A missing `stripe-signature` header → `400
   MISSING_SIGNATURE`. A failed `constructWebhookEvent` → `400 INVALID_SIGNATURE`.
   Nothing is read, logged, or written before the signature is verified.
   The signing secret comes from validated config (`serverEnv().STRIPE_WEBHOOK_SECRET`);
   if it is unset the endpoint returns `500 WEBHOOK_NOT_CONFIGURED` rather than
   accepting unverified events.
2. **Idempotency.** The event is looked up in `public.stripe_webhook_events` by
   its Stripe event id. If it is already `processed` or `unprocessable`, the
   endpoint returns `200 {received: true, duplicate: true}` without re-running
   the handler. Otherwise the event is recorded with status `received`.
   If the event log itself is unreachable → `500 EVENT_LOG_UNAVAILABLE` (Stripe retries).
3. **Dispatch** to the handler for the event type.
4. **Outcome recording** — see the retry contract below.

### Retry contract

Stripe retries any non-2xx response for up to 3 days. A handler that always
throws would therefore retry forever (a "poison event"). The endpoint
distinguishes:

| Outcome | `stripe_webhook_events.status` | HTTP | Stripe behaviour |
|---|---|---|---|
| Handled, or deliberately ignored | `processed` | 200 | done |
| Data can never satisfy the handler (missing metadata, unknown subscription, malformed payload) | `unprocessable` | 200 | stops retrying |
| Transient infrastructure failure (Supabase or Stripe unreachable) | `failed` | 500 | retries |

Classification lives in `classifyFailure()`: `PaymentsError` codes are transient
except `SUBSCRIPTION_NOT_FOUND` / `PAYMENT_NOT_FOUND` / `CONTRACT_NOT_FOUND`;
errors whose `name` starts with `Stripe` are transient; everything else is
unprocessable. A row left at `failed` is retried on the next delivery.

Table definition: `supabase/migrations/20260720002000_stripe_webhook_events.sql`.
RLS is enabled with **zero policies** — service role only.

---

## Metadata contract

Stripe metadata is the only channel connecting the code that creates an object
to the webhook that reads it. Both sides go through `lib/stripe/index.ts` so the
keys cannot drift:

| Direction | Function |
|---|---|
| write | `buildSubscriptionMetadata({ brandProfileId, userId })` |
| read | `parseSubscriptionMetadata(raw)` → `null` if absent/invalid |
| write | `buildPaymentMetadata({ contractId, payerId, payeeId })` |
| read | `parsePaymentMetadata(raw)` → `null` if absent/invalid |

All values are validated as UUIDs; a partial or empty-string value parses to
`null`, never to `''`.

### Identity mapping (the B-2 / ST-5 fix)

| Column | References | Metadata key |
|---|---|---|
| `subscriptions.brand_id` | `brand_profiles.id` | `brandProfileId` |
| `payments.payer_id` | `users.id` (paying brand user) | `payerId` |
| `payments.payee_id` | `users.id` (athlete/team) | `payeeId` |
| `payments.contract_id` | `contracts.id` | `contractId` |

`subscriptions.brand_id` is **`brand_profiles.id`**, not the auth user id.
`/api/payments/subscriptions/checkout` therefore resolves
`getBrandProfileIdForUser(user.id)` and passes it as both
`client_reference_id` and `subscription_data.metadata.brandProfileId`.

> **`subscription_data.metadata`, not session `metadata`.** Metadata set only at
> the Checkout Session level does *not* propagate to the created Subscription
> object. That omission was the root cause of every subscription insert failing
> its `brand_id` foreign key. `createCheckoutSession` now sets both.

`brand_id` is resolved defensively in the webhook, in order:

1. `parseSubscriptionMetadata(sub.metadata).brandProfileId`
2. `getSubscriptionByStripeCustomerId(sub.customer)` → existing row's `brand_id`
3. (for `checkout.session.completed`) `session.client_reference_id`

If none resolves, **no row is written** — the event is recorded `unprocessable`
and the endpoint returns 200. An invalid row is never inserted.

---

## Handled events

| Event | What it does |
|---|---|
| `checkout.session.completed` | The most reliable link point: `client_reference_id` gives `brand_profiles.id`. Retrieves the subscription from Stripe and upserts the full row (customer id, tier, status, period dates). Non-subscription sessions are ignored. |
| `customer.subscription.created` | Upserts the subscription after resolving `brand_id`. Redundant when the checkout event already arrived (upsert is on `brand_id`). |
| `customer.subscription.updated` | Updates status, tier, trial/cancel dates and period dates by `stripe_subscription_id`. |
| `customer.subscription.deleted` | Same handler; writes `status: 'canceled'` and `canceled_at`. |
| `invoice.payment_succeeded` | Re-reads the subscription from Stripe and refreshes status + `current_period_start/end` so renewals stay truthful. One-off invoices (no `subscription`) are ignored. |
| `invoice.payment_failed` | Same, but forces `past_due` when Stripe has not yet flipped an `active` subscription. |
| `payment_intent.created` | Inserts the `payments` row from the metadata contract. Skips when there is no `contractId` (non-Podium intent), skips when the `/api/payments/intents` route already inserted the row, and records `unprocessable` when `payerId`/`payeeId` are missing. |
| `payment_intent.succeeded` | Marks the payment succeeded and writes `stripe_fee`, `net_amount`, `receipt_url`. |
| `charge.succeeded` | Same settlement write, keyed off `charge.payment_intent`. Belt-and-braces for the case where the charge settles after the intent event. |
| `payment_intent.payment_failed` | Marks the payment `failed`. |

Anything else is acknowledged with 200 and recorded as `processed`.

### Fee / net / receipt

The PaymentIntent does **not** carry an expanded `charges` list on the pinned
API version — reading `pi.charges.data[0]` always yielded `null` fees. The
handler now uses `pi.latest_charge` and calls
`retrieveChargeSettlement(chargeId)` in `lib/stripe/`, which retrieves the
charge with `expand: ['balance_transaction']` and returns
`{ chargeId, receiptUrl, stripeFee, netAmount }`. Fee/net stay `null` until the
balance transaction settles, which is correct rather than silently wrong.

### Subscription status mapping

Stripe has statuses the `subscription_status` enum does not:

| Stripe | Podium |
|---|---|
| `trialing` / `active` / `past_due` / `canceled` / `paused` | same |
| `unpaid`, `incomplete` | `past_due` |
| `incomplete_expired` | `canceled` |

`subscriptions.tier` comes from `price.metadata.tier` on the subscription's
first line item, defaulting to `1` if absent or out of range — so **set
`metadata.tier` = `1`/`2`/`3` on each Stripe Price**.

---

## Testing locally

```bash
# 1. Forward events to the dev server. Copy the whsec_… it prints into .env.local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 2. In another shell, trigger events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_succeeded
stripe trigger payment_intent.succeeded
```

`stripe trigger` fixtures carry no Podium metadata, so those deliveries are
expected to land as `unprocessable` — that is the guard working. To exercise a
real flow end to end, run the actual checkout (`POST /api/payments/subscriptions/checkout`)
in test mode and pay with card `4242 4242 4242 4242`.

Inspect what happened:

```sql
select id, type, status, error, received_at
from stripe_webhook_events
order by received_at desc
limit 20;
```

Replay a specific delivery from the Stripe Dashboard
(Developers → Webhooks → event → **Resend**). Deliveries whose event id is
already `processed`/`unprocessable` short-circuit; delete the row first if you
want a genuine re-run.

Unit tests: `app/api/webhooks/stripe/route.test.ts` (signature, idempotency,
poison-event classification, every handler) and `lib/stripe/index.test.ts`
(metadata round-trip, `subscription_data.metadata` placement, charge settlement).
