-- ============================================================
-- JOB LISTINGS (brand's marketplace presence)
-- ============================================================

create table public.job_listings (
  id                       uuid primary key default gen_random_uuid(),
  brand_id                 uuid not null references public.brand_profiles(id) on delete cascade,
  type                     public.listing_type not null,
  status                   public.listing_status not null default 'draft',
  title                    text not null,
  description              text,
  sport_required           text,
  level_required           text,
  location                 text,
  is_remote                boolean not null default false,
  pay_amount               numeric,
  pay_currency             text not null default 'GBP',
  pay_type                 public.pay_type,
  deliverables             jsonb not null default '{}',
  contract_duration_months integer,
  usage_rights             jsonb,
  application_deadline     timestamptz,
  multiple_hires           boolean not null default false,
  max_hires                integer,
  -- Team sponsorship campaign fields
  total_sponsorship_budget  numeric,
  sponsorship_structure     text,
  what_expected             jsonb,
  exclusivity_required      boolean not null default false,
  number_of_teams_sought    integer,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_job_listings_updated_at
  before update on public.job_listings
  for each row execute procedure public.set_updated_at();

alter table public.job_listings enable row level security;

-- Any authenticated user sees active listings; brand sees own drafts too
create policy "job_listings_select"
  on public.job_listings for select
  using (
    status = 'active'
    or brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "job_listings_insert"
  on public.job_listings for insert
  with check (
    brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  );

create policy "job_listings_update"
  on public.job_listings for update
  using (
    brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  );

-- ============================================================
-- CONNECTION REQUESTS
-- ============================================================

create table public.connection_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  status       public.connection_status not null default 'pending',
  -- message is required (max 300 chars enforced at application layer)
  message      text not null,
  sent_at      timestamptz not null default now(),
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Prevent duplicate pending requests between same pair
  constraint connection_requests_no_self_connect check (sender_id != recipient_id)
);

create trigger set_connection_requests_updated_at
  before update on public.connection_requests
  for each row execute procedure public.set_updated_at();

alter table public.connection_requests enable row level security;

create policy "connection_requests_select"
  on public.connection_requests for select
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_admin()
  );

create policy "connection_requests_insert"
  on public.connection_requests for insert
  with check (sender_id = auth.uid());

-- Recipient can accept/decline; sender can withdraw
create policy "connection_requests_update"
  on public.connection_requests for update
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

-- ============================================================
-- MATCHES
-- ============================================================

create table public.matches (
  id                    uuid primary key default gen_random_uuid(),
  user_a_id             uuid not null references public.users(id) on delete cascade,
  user_b_id             uuid not null references public.users(id) on delete cascade,
  connection_request_id uuid references public.connection_requests(id),
  status                public.match_status not null default 'active',
  -- Brand must send a proposal_card before free-text messaging unlocks
  proposal_required     boolean not null default true,
  proposal_sent         boolean not null default false,
  matched_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint matches_unique_pair unique (user_a_id, user_b_id),
  constraint matches_no_self_match check (user_a_id != user_b_id)
);

create trigger set_matches_updated_at
  before update on public.matches
  for each row execute procedure public.set_updated_at();

-- Defined here (after matches table) because SQL functions validate their body at creation time.
create or replace function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.matches
    where id = p_match_id
    and (user_a_id = auth.uid() or user_b_id = auth.uid())
  );
$$;

alter table public.matches enable row level security;

create policy "matches_select"
  on public.matches for select
  using (
    user_a_id = auth.uid()
    or user_b_id = auth.uid()
    or public.is_admin()
  );

-- Matches are created by service role (trigger on connection_request accepted)
-- No client INSERT policy

create policy "matches_update"
  on public.matches for update
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- ============================================================
-- SHORTLISTS
-- ============================================================

create table public.shortlists (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint shortlists_unique unique (user_id, target_user_id),
  constraint shortlists_no_self check (user_id != target_user_id)
);

alter table public.shortlists enable row level security;

create policy "shortlists_select"
  on public.shortlists for select
  using (user_id = auth.uid());

create policy "shortlists_insert"
  on public.shortlists for insert
  with check (user_id = auth.uid());

create policy "shortlists_delete"
  on public.shortlists for delete
  using (user_id = auth.uid());

-- ============================================================
-- BLOCKS
-- ============================================================

create table public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_unique unique (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id != blocked_id)
);

alter table public.blocks enable row level security;

-- Blocker sees their own blocks; blocked user cannot see they are blocked
create policy "blocks_select"
  on public.blocks for select
  using (blocker_id = auth.uid() or public.is_admin());

create policy "blocks_insert"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

create policy "blocks_delete"
  on public.blocks for delete
  using (blocker_id = auth.uid());
