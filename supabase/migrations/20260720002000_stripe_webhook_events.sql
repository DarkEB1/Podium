-- ============================================================
-- STRIPE WEBHOOK EVENT LOG
--
-- Idempotency + poison-event guard for app/api/webhooks/stripe.
--
-- Stripe retries a webhook for up to 3 days whenever the endpoint does not
-- return 2xx. Without a record of what has already been processed, a retry
-- re-runs handlers (double inserts), and a permanently-failing (poison) event
-- retries forever. This table gives the handler:
--   1. dedupe    — `id` is the Stripe event id, primary key
--   2. triage    — `status` distinguishes a transient failure (retry wanted)
--                  from an unprocessable/malformed event (retry pointless)
--   3. forensics — `payload` + `error` for replay and debugging
-- ============================================================

create type public.stripe_webhook_event_status as enum (
  'received',      -- signature verified, handler not finished
  'processed',     -- handled successfully; further deliveries are no-ops
  'failed',        -- transient failure; endpoint returned 500, Stripe will retry
  'unprocessable'  -- unrecoverable/malformed; endpoint returned 200, no retry
);

create table public.stripe_webhook_events (
  -- Stripe event id (evt_...). Primary key = idempotency key.
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  status       public.stripe_webhook_event_status not null default 'received',
  error        text,
  payload      jsonb
);

create index stripe_webhook_events_status_idx
  on public.stripe_webhook_events (status);

create index stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

alter table public.stripe_webhook_events enable row level security;

-- Deliberately NO policies: RLS is enabled with zero policies, so every
-- non-service-role client (anon + authenticated) is denied on all operations.
-- Only the Stripe webhook handler, which uses the service role key, may
-- read or write this table.
