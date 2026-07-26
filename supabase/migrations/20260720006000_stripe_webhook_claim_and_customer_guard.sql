-- =============================================================================
-- Stripe webhook hardening — atomic event claim + customer-id guard
-- =============================================================================
-- Fixes three defects found auditing app/api/webhooks/stripe/route.ts:
--
--   D1 — unknown errors were treated as permanent, so a transient blip wrote a
--        terminal status and Stripe never retried. The handler now defaults to
--        "transient", which needs an attempt counter so a genuinely poisonous
--        event still stops eventually (see `attempts` below).
--
--   D2 — an unresolvable Stripe customer was written as the empty string into
--        subscriptions.stripe_customer_id (text not null, no FK), which then
--        made the customer-id fallback resolver ambiguous. The CHECK
--        constraints below stop that class of row at the database.
--
--   D3 — the "have I seen this event?" read and the insert were two separate
--        statements, so two concurrent deliveries of the same event id could
--        both proceed into the handlers. claim_stripe_webhook_event() collapses
--        both into one atomic statement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D1/D3 — claim bookkeeping on the event log
-- -----------------------------------------------------------------------------
alter table public.stripe_webhook_events
  -- Number of times a worker has claimed this event. Drives the poison-event
  -- cap in the route: unknown failures now retry by default, so something has
  -- to stop an event that fails forever.
  add column if not exists attempts integer not null default 0,
  -- When the current holder claimed the event. Used only to detect a worker
  -- that died mid-flight (serverless: no unlock on crash), never as a lock by
  -- itself — the row lock inside the INSERT .. ON CONFLICT is the real lock.
  add column if not exists claimed_at timestamptz;

comment on column public.stripe_webhook_events.attempts is
  'Times this event has been claimed for processing. The webhook gives up (marks unprocessable) past a fixed cap.';
comment on column public.stripe_webhook_events.claimed_at is
  'When the current holder claimed the event; lets a crashed in-flight claim be taken over after a staleness window.';

-- -----------------------------------------------------------------------------
-- claim_stripe_webhook_event — atomically take ownership of one delivery.
-- -----------------------------------------------------------------------------
-- Exactly one caller can win a claim for a given event id at a time. The whole
-- decision is a single INSERT .. ON CONFLICT DO UPDATE statement, which takes a
-- row lock and re-evaluates its WHERE against the winner's committed row, so a
-- concurrent duplicate delivery sees the claimed row and loses.
--
-- Claim is granted when:
--   * the row does not exist yet                      → first delivery
--   * status = 'failed'                               → the previous worker
--     finished and recorded a transient failure; Stripe is retrying, and a
--     retry is exactly what 'failed' means. Never gated on staleness, or the
--     first Stripe retry (~1 minute) would be silently dropped.
--   * status = 'received' and the claim is stale      → the previous worker
--     never reported back (crash / timeout). Without this the event would be
--     stuck in-flight forever.
--
-- Claim is refused when status is 'processed' or 'unprocessable' (terminal), or
-- when another worker holds a fresh 'received' claim.
create or replace function public.claim_stripe_webhook_event(
  p_id                   text,
  p_type                 text,
  p_payload              jsonb,
  p_stale_after_seconds  integer default 300
)
returns table (
  did_claim     boolean,
  attempt_count integer,
  event_status  public.stripe_webhook_event_status
)
language plpgsql
security definer
-- Pinned so a caller-controlled search_path cannot redirect these writes.
set search_path = public, pg_temp
as $$
declare
  v_now      timestamptz := now();
  v_attempts integer;
  v_status   public.stripe_webhook_event_status;
  v_claimed  boolean := false;
begin
  insert into public.stripe_webhook_events as swe
    (id, type, payload, status, attempts, claimed_at)
  values
    (p_id, p_type, p_payload, 'received', 1, v_now)
  on conflict (id) do update
    set attempts   = swe.attempts + 1,
        claimed_at = v_now,
        status     = 'received',
        type       = excluded.type,
        payload    = coalesce(excluded.payload, swe.payload)
    where
      swe.status = 'failed'
      or (
        swe.status = 'received'
        and (
          swe.claimed_at is null
          or swe.claimed_at < v_now - make_interval(secs => p_stale_after_seconds)
        )
      )
  returning swe.attempts, swe.status into v_attempts, v_status;

  if found then
    v_claimed := true;
  else
    -- Lost the claim: report the current state so the caller can tell a
    -- terminal duplicate from a delivery another worker is handling.
    select swe.attempts, swe.status
      into v_attempts, v_status
      from public.stripe_webhook_events swe
     where swe.id = p_id;
  end if;

  return query select v_claimed, coalesce(v_attempts, 0), v_status;
end;
$$;

comment on function public.claim_stripe_webhook_event(text, text, jsonb, integer) is
  'Atomically claims one Stripe webhook delivery. Returns (did_claim, attempt_count, event_status); exactly one concurrent caller can win.';

-- Service role only — this is the webhook handler's lock.
revoke all on function public.claim_stripe_webhook_event(text, text, jsonb, integer) from public;
revoke all on function public.claim_stripe_webhook_event(text, text, jsonb, integer) from anon;
revoke all on function public.claim_stripe_webhook_event(text, text, jsonb, integer) from authenticated;

-- -----------------------------------------------------------------------------
-- D2 — no placeholder Stripe ids on subscriptions
-- -----------------------------------------------------------------------------
-- subscriptions.stripe_customer_id is `text not null` with no foreign key, so
-- `''` inserted silently. Two such rows made the customer-id fallback resolver
-- ambiguous, which surfaced as a generic fetch failure and (before D1) an
-- infinite 500 retry loop.
--
-- Added NOT VALID on purpose: existing rows are not scanned. Whether any live
-- row already holds '' cannot be checked from the repository (no database is
-- reachable from the test suite, and the migration must not fail a deploy on
-- historical data). NOT VALID still enforces the rule for every INSERT and
-- UPDATE from now on, which is what closes the defect. Run
--   alter table public.subscriptions validate constraint <name>;
-- once the existing rows have been inspected and repaired.
alter table public.subscriptions
  add constraint subscriptions_stripe_customer_id_not_blank
  check (btrim(stripe_customer_id) <> '') not valid;

alter table public.subscriptions
  add constraint subscriptions_stripe_subscription_id_not_blank
  check (btrim(stripe_subscription_id) <> '') not valid;

-- Deliberately NO unique index on stripe_customer_id: one Stripe customer
-- legitimately maps to one brand today, but nothing in the schema or in Stripe
-- forbids two brand profiles sharing a customer, and existing data cannot be
-- verified from here. The blank-id CHECK removes the actual cause of the
-- ambiguity; the resolver in lib/supabase/payments.ts is also now written to
-- tolerate more than one match instead of erroring.
