# API — Payments

## Surface Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/payments/subscriptions/me` | required | Get current brand subscription |
| `POST` | `/api/payments/subscriptions/checkout` | required (brand) | Create Stripe checkout session |
| `POST` | `/api/payments/subscriptions/cancel` | required (brand) | Schedule subscription cancellation |
| `POST` | `/api/payments/intents` | required (brand) | Create payment intent for a contract |
| `GET` | `/api/payments/history` | required | Get payment history for current user |
| `GET` | `/api/payments/[contractId]` | required | Get payment for a specific contract |
| `POST` | `/api/webhooks/stripe` | HMAC signature | Stripe webhook event handler |

---

## GET /api/payments/subscriptions/me

**Auth:** Session cookie required

**Description:** Returns the authenticated brand's current subscription, or null if no subscription exists.

**Success 200:**
```ts
{
  id: string
  brand_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  tier: 1 | 2 | 3
  status: "trialing" | "active" | "past_due" | "canceled" | "paused"
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  canceled_at: string | null
  cancellation_scheduled_at: string | null
  created_at: string
  updated_at: string
} | null
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/payments/subscriptions/checkout

**Auth:** Session cookie required (brand role only)

**Description:** Creates a Stripe Checkout session for a subscription tier. Returns a redirect URL to Stripe's hosted checkout page. All tiers include a 7-day free trial (card required upfront). On checkout completion, the `customer.subscription.created` webhook fires and creates the subscription record.

**Request body:**
```ts
{ "tier": 1 | 2 | 3 }
```

**Success 200:**
```ts
{ "url": string, "sessionId": string }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | tier is required |
| 400 | INVALID_TIER | tier must be 1, 2, or 3 |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | BRAND_ONLY | Non-brand account attempted subscription |

---

## POST /api/payments/subscriptions/cancel

**Auth:** Session cookie required (brand role only)

**Description:** Schedules the brand's subscription to cancel at the end of the current billing period. Sets `cancellation_scheduled_at` immediately; the subscription remains active until `current_period_end`. The `customer.subscription.updated` webhook will update the final status.

**Request body:** none

**Success 200:**
```ts
{ "message": "Subscription will cancel at the end of the current billing period" }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | BRAND_ONLY | Non-brand account attempted cancellation |
| 404 | NO_SUBSCRIPTION | Brand has no active subscription |
| 422 | CANCEL_FAILED | Stripe returned an error during cancellation |

---

## POST /api/payments/intents

**Auth:** Session cookie required (brand role only)

**Description:** Creates a Stripe PaymentIntent for a signed contract. Returns the `clientSecret` for use with Stripe.js on the frontend. Also creates a `pending` payment record in the database. Amount and currency are sourced server-side from the contract's linked proposal — client cannot override these.

**Request body:**
```ts
{ "contractId": string }
```

**Success 201:**
```ts
{
  "clientSecret": string,
  "paymentIntentId": string,
  "paymentId": string
}
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_FIELDS | contractId is required |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | BRAND_ONLY | Non-brand account attempted payment |
| 403 | NOT_CONTRACT_BRAND | Authenticated user is not the brand on this contract |
| 404 | CONTRACT_NOT_FOUND | Contract not found or not accessible |
| 404 | NO_SUBSCRIPTION | Brand has no subscription (no Stripe customer ID) |

---

## GET /api/payments/history

**Auth:** Session cookie required

**Description:** Returns all payments where the authenticated user is either the payer (brand) or payee (athlete/team), ordered by most recent first.

**Success 200:**
```ts
Array<{
  id: string
  contract_id: string
  payer_id: string
  payee_id: string
  stripe_payment_intent_id: string
  amount: number
  currency: string
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded"
  receipt_url: string | null
  stripe_fee: number | null
  platform_fee: number | null
  net_amount: number | null
  processed_at: string | null
  tax_disclaimer_shown: boolean
  created_at: string
  updated_at: string
}>
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## GET /api/payments/[contractId]

**Auth:** Session cookie required

**Description:** Returns the payment for a specific contract, or null if no payment has been initiated yet.

**Success 200:**
```ts
{ /* Payment row as above */ } | null
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 401 | UNAUTHENTICATED | No valid session |

---

## POST /api/webhooks/stripe

**Auth:** Stripe HMAC signature (`stripe-signature` header, verified with `STRIPE_WEBHOOK_SECRET`)

**Description:** Handles Stripe webhook events. Must not be behind authentication middleware. Raw body is read and verified before any processing.

**Handled events:**

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Upserts subscription record |
| `customer.subscription.updated` | Updates subscription status/period |
| `customer.subscription.deleted` | Updates subscription to canceled |
| `payment_intent.created` | Creates pending payment record (only for intents with `contractId` metadata) |
| `payment_intent.succeeded` | Updates payment to succeeded, records fee breakdown and receipt URL |
| `payment_intent.payment_failed` | Updates payment to failed |

**Success 200:**
```ts
{ "received": true }
```

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | MISSING_SIGNATURE | `stripe-signature` header absent |
| 400 | INVALID_SIGNATURE | HMAC verification failed |
