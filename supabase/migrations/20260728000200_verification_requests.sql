-- ============================================================
-- Verification badges — the review queue (spec §6A / §trust)
--
-- Profiles could be marked verified, but there was no way for a user to REQUEST
-- verification and no admin queue to review it. This adds that request/review
-- record. It is the single source of truth for the verified badge across every
-- role (verified == the user has an approved request), so no per-role profile
-- column has to be added or kept in sync.
--
-- A real KYC/identity provider (Stripe Identity, Persona, Onfido) can later
-- populate evidence_url and auto-transition status; until then an admin reviews
-- manually. Nothing here assumes a provider.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_request_status') then
    create type public.verification_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

create table if not exists public.verification_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  role         text not null,
  status       public.verification_request_status not null default 'pending',
  note         text,                 -- optional context from the requester
  evidence_url text,                 -- optional supporting document (KYC/provider later)
  review_note  text,                 -- admin's decision note
  reviewed_by  uuid references public.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.verification_requests is
  'Verification badge requests and their admin review. verified == an approved row exists for the user. Source of truth for the badge across all roles.';

-- At most one open (pending) request per user.
create unique index if not exists verification_requests_one_pending
  on public.verification_requests (user_id)
  where status = 'pending';

create index if not exists verification_requests_status_idx
  on public.verification_requests (status);

create index if not exists verification_requests_user_idx
  on public.verification_requests (user_id);

drop trigger if exists set_verification_requests_updated_at on public.verification_requests;
create trigger set_verification_requests_updated_at
  before update on public.verification_requests
  for each row execute procedure public.set_updated_at();

alter table public.verification_requests enable row level security;

-- A user sees and creates their own requests; an admin sees and reviews all.
drop policy if exists verification_requests_select_own on public.verification_requests;
create policy verification_requests_select_own
  on public.verification_requests for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists verification_requests_insert_own on public.verification_requests;
create policy verification_requests_insert_own
  on public.verification_requests for insert
  with check (user_id = auth.uid());

drop policy if exists verification_requests_admin_update on public.verification_requests;
create policy verification_requests_admin_update
  on public.verification_requests for update
  using (public.is_admin())
  with check (public.is_admin());
