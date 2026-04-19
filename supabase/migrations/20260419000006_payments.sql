-- ============================================================
-- SUBSCRIPTIONS (brand monthly subscriptions via Stripe)
-- ============================================================

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  brand_id                 uuid not null unique references public.brand_profiles(id) on delete cascade,
  stripe_customer_id       text not null,
  stripe_subscription_id   text not null,
  -- tier: 1 = Starter, 2 = Growth, 3 = Enterprise
  tier                     integer not null check (tier in (1, 2, 3)),
  status                   public.subscription_status not null,
  trial_ends_at            timestamptz,
  current_period_start     timestamptz not null,
  current_period_end       timestamptz not null,
  canceled_at              timestamptz,
  cancellation_scheduled_at timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Brand sees own subscription; admin sees all; service role bypasses RLS
create policy "subscriptions_select"
  on public.subscriptions for select
  using (
    brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
    or public.is_admin()
  );

-- INSERT and UPDATE are service-role only (Stripe webhook handler)

-- ============================================================
-- PAYMENTS (deal payments between brand and athlete/team)
-- ============================================================

create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  contract_id              uuid not null references public.contracts(id),
  payer_id                 uuid not null references public.users(id),
  payee_id                 uuid not null references public.users(id),
  stripe_payment_intent_id text not null,
  amount                   numeric not null,
  currency                 text not null default 'GBP',
  status                   public.payment_status not null default 'pending',
  receipt_url              text,
  stripe_fee               numeric,
  platform_fee             numeric,
  net_amount               numeric,
  processed_at             timestamptz,
  -- True once the tax disclaimer has been shown to the payee (first payment only)
  tax_disclaimer_shown     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

alter table public.payments enable row level security;

create policy "payments_select"
  on public.payments for select
  using (
    payer_id = auth.uid()
    or payee_id = auth.uid()
    or public.is_admin()
  );

-- INSERT and UPDATE are service-role only (Stripe webhook handler)
