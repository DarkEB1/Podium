-- ============================================================
-- B5 — PAYMENTS / FINANCIAL (plan §1.5 B5, spec §3C.5, §4C.1)
--
-- Adds athlete payout details (bank + Stripe Connect), a saved
-- payment_methods table (Stripe-mirrored card metadata, no PANs),
-- and brand subscription seat columns.
--
-- Billing history is sourced from Stripe + the existing `payments`
-- table — no invoices table is created here.
-- ============================================================

-- ------------------------------------------------------------
-- Athlete payout: how an athlete receives deal payouts.
-- ------------------------------------------------------------
create type public.payout_method as enum (
  'bank_transfer',
  'stripe_connect'
);

-- Mirrors Stripe Connect account onboarding state (set via service role / webhook).
create type public.stripe_connect_status as enum (
  'not_started',
  'pending',
  'restricted',
  'active'
);

alter table public.athlete_profiles add column if not exists payout_method public.payout_method;
-- Bank-transfer details: only the last 4 of account number / sort code are
-- stored (no full numbers). Full details live in Stripe.
alter table public.athlete_profiles add column if not exists payout_bank_name text;
alter table public.athlete_profiles add column if not exists payout_account_holder text;
alter table public.athlete_profiles add column if not exists payout_account_last4 text;
alter table public.athlete_profiles add column if not exists payout_sort_code_last4 text;
-- ISO-3166 alpha-2 of the payout bank account.
alter table public.athlete_profiles add column if not exists payout_country text;
-- Stripe Connect: account id + onboarding status, written by service role only.
alter table public.athlete_profiles add column if not exists stripe_connect_account_id text;
alter table public.athlete_profiles add column if not exists stripe_connect_status public.stripe_connect_status;
alter table public.athlete_profiles add column if not exists stripe_connect_onboarded_at timestamptz;

-- ------------------------------------------------------------
-- Saved payment methods (brand cards). Mirrors Stripe — never the raw PAN.
-- ------------------------------------------------------------
create table public.payment_methods (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  stripe_customer_id       text not null,
  stripe_payment_method_id text not null unique,
  -- Card display metadata returned by Stripe.
  brand                    text,
  last4                    text,
  exp_month                integer,
  exp_year                 integer,
  is_default               boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index payment_methods_user_id_idx on public.payment_methods (user_id);

create trigger set_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute procedure public.set_updated_at();

alter table public.payment_methods enable row level security;

-- Owner sees own payment methods; admin sees all.
create policy "payment_methods_select"
  on public.payment_methods for select
  using (user_id = auth.uid() or public.is_admin());

-- Owner may remove their own saved card; the matching Stripe detach is handled
-- by lib/stripe. INSERT/UPDATE are service-role only (Stripe webhook handler).
create policy "payment_methods_delete_owner"
  on public.payment_methods for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Brand subscription seats (§4C.1 seat management).
-- ------------------------------------------------------------
alter table public.subscriptions add column if not exists seats_total integer not null default 1;
alter table public.subscriptions add column if not exists seats_used integer not null default 1;
