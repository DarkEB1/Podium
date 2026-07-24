-- ============================================================
-- SEC-10 — STRIPE WEBHOOK EVENT LOG: IDEMPOTENT (RE-RUNNABLE) DDL
--
-- 20260720002000_stripe_webhook_events.sql is the only new migration whose DDL
-- is bare:
--   :16  create type public.stripe_webhook_event_status as enum (...)
--   :23  create table public.stripe_webhook_events (...)
--   :34  create index stripe_webhook_events_status_idx ...
--   :37  create index stripe_webhook_events_received_at_idx ...
-- Every other 20260720* migration guards its objects (`if not exists`, `drop
-- ... if exists` first). If any of these four objects already exists — a
-- partially-applied deploy, a hotfix applied by hand, a branch database, a
-- shadow database reused by `db diff` — the statement raises 42710/42P07 and
-- takes the whole transaction (and therefore the rest of the migration run)
-- with it.
--
-- That file is owned by the Stripe workstream right now, so the guard lives
-- here instead of being edited in place: this migration converges the schema to
-- the intended shape using only idempotent statements. It is a no-op on a
-- database where 20260720002000 applied cleanly.
--
-- LIMITATION, stated plainly: this cannot make 20260720002000 itself
-- re-runnable. If that file runs against a database that already has the type
-- or the table, it still aborts before this file is reached. The permanent fix
-- is to guard the DDL in 20260720002000; whoever owns it should do so.
--
-- (The privacy question about stripe_webhook_events.payload — it contains the
-- customer's email, name and billing address — is answered in
-- 20260720005003_gdpr_erasure_hardening.sql: the row is retained as the Stripe
-- idempotency key and the payload is nulled on erasure.)
-- ============================================================

do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'stripe_webhook_event_status'
       and n.nspname = 'public'
  ) then
    create type public.stripe_webhook_event_status as enum (
      'received',      -- signature verified, handler not finished
      'processed',     -- handled successfully; further deliveries are no-ops
      'failed',        -- transient failure; endpoint returned 500, Stripe retries
      'unprocessable'  -- unrecoverable/malformed; endpoint returned 200, no retry
    );
  end if;
end;
$$;

create table if not exists public.stripe_webhook_events (
  -- Stripe event id (evt_...). Primary key = idempotency key.
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  status       public.stripe_webhook_event_status not null default 'received',
  error        text,
  payload      jsonb
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (status);

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Stripe webhook idempotency + poison-event log. RLS is enabled with ZERO policies on purpose: anon and authenticated are denied everything, only the service-role webhook handler reads or writes it. payload holds customer email/name/billing address and is nulled by erase_user_data() (SEC-6).';
