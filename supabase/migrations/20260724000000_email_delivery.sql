-- ============================================================================
-- Email delivery log + suppression list
-- ============================================================================
-- Backs the transactional email layer (lib/email). Two tables:
--
--   email_deliveries   — one row per send attempt: an audit trail, the
--                        idempotency key that stops a webhook retry from
--                        emailing a user twice, and the raw material for a
--                        "why didn't I get the email" support question.
--   email_suppressions — addresses we must never email again: hard bounces,
--                        spam complaints, and explicit unsubscribes. Checked
--                        before every send (FA-10 / CAN-SPAM / UK PECR).
--
-- Both are written only by the service role (the email layer runs server-side
-- with the admin client). RLS is enabled with owner-read policies so a user can
-- see their own delivery history in settings, but never another user's, and
-- never the suppression list (which would leak other users' addresses).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_delivery_status') then
    create type public.email_delivery_status as enum (
      'queued',      -- accepted by the provider, awaiting a delivery signal
      'sent',        -- provider accepted the message
      'delivered',   -- provider confirmed delivery (via webhook, if wired)
      'bounced',     -- hard bounce — address suppressed
      'complained',  -- marked as spam — address suppressed
      'failed',      -- all send attempts exhausted
      'suppressed',  -- not sent: address was on the suppression list
      'skipped'      -- not sent: the user's preferences opted out of this event
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'email_suppression_reason') then
    create type public.email_suppression_reason as enum (
      'hard_bounce',
      'complaint',
      'unsubscribe',
      'manual'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- email_deliveries
-- ----------------------------------------------------------------------------
create table if not exists public.email_deliveries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,
  -- Recorded separately from user_id so a delivery survives account erasure as
  -- an anonymisable audit row (the GDPR routine nulls to_email in place).
  to_email       text not null,
  event_type     text not null,
  subject        text not null,
  status         public.email_delivery_status not null default 'queued',
  -- Provider-side id (Resend message id), when the send succeeded.
  provider_id    text,
  -- Number of send attempts made (FA-10 backoff).
  attempts       integer not null default 0,
  error          text,
  -- Idempotency key: a caller passes a stable string (e.g.
  -- "contract_signed:<contractId>") and a second send with the same key is a
  -- no-op. This is what makes a Stripe webhook retry safe.
  idempotency_key text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.email_deliveries is
  'Audit trail + idempotency ledger for transactional email. Service-role write only.';

create unique index if not exists email_deliveries_idempotency_key_uidx
  on public.email_deliveries (idempotency_key)
  where idempotency_key is not null;

create index if not exists email_deliveries_user_id_idx
  on public.email_deliveries (user_id, created_at desc);

create trigger set_email_deliveries_updated_at
  before update on public.email_deliveries
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- email_suppressions
-- ----------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  -- Normalised (trimmed + lowercased) address is the key: suppression is about
  -- the mailbox, not the account, and one address can outlive many accounts.
  email        text primary key,
  reason       public.email_suppression_reason not null,
  user_id      uuid references public.users(id) on delete set null,
  detail       text,
  created_at   timestamptz not null default now()
);

comment on table public.email_suppressions is
  'Addresses that must never be emailed again (bounce/complaint/unsubscribe). Checked before every send.';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.email_deliveries enable row level security;
alter table public.email_suppressions enable row level security;

-- A user may read their own delivery history (for a settings "email activity"
-- view); admins may read all for support. No client INSERT/UPDATE/DELETE — the
-- email layer writes with the service role, which bypasses RLS.
create policy "email_deliveries_select_own"
  on public.email_deliveries for select
  using (user_id = auth.uid() or public.is_admin());

-- The suppression list is deliberately NOT readable by ordinary users: it is a
-- table of email addresses, and exposing it would leak other users' addresses.
-- Admin-only read; service role bypasses RLS for the send-time lookup.
create policy "email_suppressions_select_admin"
  on public.email_suppressions for select
  using (public.is_admin());
