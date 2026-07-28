-- ============================================================
-- Stripe Connect — athlete payout accounts (spec §payments)
--
-- Athletes/teams receive deal payments, which requires a Connect account to pay
-- out to. This table tracks each user's Connect account and its onboarding
-- state, synced from Stripe via the connect webhook. Requires Stripe Connect to
-- be enabled on the platform account; the app fails closed with a clear message
-- until it is.
-- ============================================================

create table if not exists public.connect_accounts (
  user_id           uuid primary key references public.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.connect_accounts is
  'Stripe Connect (Express) account per payee and its onboarding/payout readiness, synced from Stripe. Service-role written.';

drop trigger if exists set_connect_accounts_updated_at on public.connect_accounts;
create trigger set_connect_accounts_updated_at
  before update on public.connect_accounts
  for each row execute procedure public.set_updated_at();

alter table public.connect_accounts enable row level security;

-- A user reads only their own Connect status; writes are service-role only.
drop policy if exists connect_accounts_select_own on public.connect_accounts;
create policy connect_accounts_select_own
  on public.connect_accounts for select
  using (user_id = auth.uid());
