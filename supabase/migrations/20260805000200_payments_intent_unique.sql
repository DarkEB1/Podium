-- ============================================================
-- ST-7 — one payments row per Stripe payment intent
-- ============================================================
--
-- `payments.stripe_payment_intent_id` carried no unique constraint, and
-- `/api/payments/intents` inserted a row on every call with no existing-payment
-- check. Stripe's idempotency key (`pi_<contractId>`) returns the SAME intent
-- for a repeat POST, so a second call produced two rows sharing one intent id.
--
-- `getPaymentByIntentId` reads with `.single()`, which raises PGRST116 on
-- multiple rows; that code is swallowed as "no row". The webhook therefore
-- concluded there was no payments row for a real intent, marked the settlement
-- unprocessable and answered 200, so Stripe never retried: a charged payment
-- stayed 'pending' forever, with no fee, no receipt and no payment_received
-- email to the athlete.
--
-- The route now refuses a second intent for a contract that already has a live
-- payment. This index is the backstop that makes the invariant true regardless
-- of which writer gets there (the webhook inserts too, with the service role).
--
-- Partial on NOT NULL because the column is nullable and several rows may
-- legitimately sit with a NULL intent id.

-- Collapse any duplicates that already exist, keeping the earliest row (the one
-- the intents route returned to the browser, so the one any client holds).
delete from public.payments p
 using public.payments q
 where p.stripe_payment_intent_id is not null
   and p.stripe_payment_intent_id = q.stripe_payment_intent_id
   and (p.created_at, p.id) > (q.created_at, q.id);

create unique index if not exists payments_stripe_payment_intent_id_key
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

comment on index public.payments_stripe_payment_intent_id_key is
  'ST-7: one payments row per Stripe intent. getPaymentByIntentId uses .single(), which reads a duplicate as "no row" and strands the settlement.';
