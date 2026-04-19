-- ============================================================
-- ATHLETE PROFILES
-- ============================================================

create table public.athlete_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users(id) on delete cascade,
  status                public.profile_status not null default 'draft',
  display_name          text,
  full_legal_name       text,
  date_of_birth         date,
  is_under_18           boolean not null default false,
  height_cm             integer,
  weight_kg             numeric,
  phone                 text,
  profile_photo_url     text,
  primary_sport         text,
  secondary_sport       text,
  position              text,
  level                 public.athlete_level,
  years_active          integer,
  notable_achievements  text,
  performance_stats     jsonb not null default '{}',
  social_accounts       jsonb not null default '{}',
  home_city             text,
  home_country          text,
  -- travel_radius_km: 0/25/50/100/200 = km; null = nationwide; -1 = international
  travel_radius_km      integer,
  availability_status   public.availability_status,
  available_from_date   date,
  has_agent             boolean not null default false,
  guardian_name         text,
  guardian_relationship text,
  guardian_email        text,
  guardian_phone        text,
  guardian_accepted_at  timestamptz,
  seeking               text[] not null default '{}',
  discovery_ui_mode     public.ui_mode not null default 'marketplace',
  display_theme         public.display_theme not null default 'light',
  chat_retention_days   integer,
  notification_prefs    jsonb not null default '{}',
  last_active_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Trigger: auto-compute is_under_18 from date_of_birth on insert/update
create or replace function public.compute_is_under_18()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth is not null then
    new.is_under_18 = (new.date_of_birth > current_date - interval '18 years');
  end if;
  return new;
end;
$$;

create trigger athlete_profiles_compute_age
  before insert or update of date_of_birth on public.athlete_profiles
  for each row execute procedure public.compute_is_under_18();

create trigger set_athlete_profiles_updated_at
  before update on public.athlete_profiles
  for each row execute procedure public.set_updated_at();

alter table public.athlete_profiles enable row level security;

-- Public can read active profiles; owner reads own at any status
create policy "athlete_profiles_select"
  on public.athlete_profiles for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "athlete_profiles_insert"
  on public.athlete_profiles for insert
  with check (user_id = auth.uid());

create policy "athlete_profiles_update"
  on public.athlete_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- TEAM PROFILES
-- ============================================================

create table public.team_profiles (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null unique references public.users(id) on delete cascade,
  status                        public.profile_status not null default 'draft',
  team_name                     text,
  nickname                      text,
  sports                        text[] not null default '{}',
  competition_level             public.team_level,
  year_founded                  integer,
  logo_url                      text,
  cover_photo_url               text,
  bio                           text,
  home_city                     text,
  home_country                  text,
  home_venue                    text,
  match_day_attendance          integer,
  fan_reach                     public.fan_reach,
  social_accounts               jsonb not null default '{}',
  total_social_following        integer not null default 0,
  press_mentions                text,
  seeking_sponsorship_types     text[] not null default '{}',
  total_sponsorship_value_sought numeric,
  sponsorship_brief_url         text,
  offers_to_sponsors            jsonb not null default '{}',
  commercial_manager_name       text,
  commercial_manager_email      text,
  commercial_manager_phone      text,
  primary_controller_name       text,
  primary_controller_role       text,
  primary_controller_email      text,
  primary_controller_phone      text,
  discovery_ui_mode             public.ui_mode not null default 'marketplace',
  display_theme                 public.display_theme not null default 'light',
  notification_prefs            jsonb not null default '{}',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger set_team_profiles_updated_at
  before update on public.team_profiles
  for each row execute procedure public.set_updated_at();

alter table public.team_profiles enable row level security;

create policy "team_profiles_select"
  on public.team_profiles for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "team_profiles_insert"
  on public.team_profiles for insert
  with check (user_id = auth.uid());

create policy "team_profiles_update"
  on public.team_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- BRAND PROFILES
-- ============================================================

create table public.brand_profiles (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null unique references public.users(id) on delete cascade,
  status                      public.brand_status not null default 'pending_approval',
  company_name                text not null,
  trading_name                text,
  industry                    public.brand_industry,
  description                 text,
  headquarters_city           text,
  headquarters_country        text,
  website_url                 text,
  linkedin_url                text not null,
  social_accounts             jsonb not null default '{}',
  logo_url                    text,
  cover_image_url             text,
  seeking                     text[] not null default '{}',
  target_sports               text[] not null default '{}',
  target_level                text,
  geographic_preference       text,
  company_registration_number text,
  vat_number                  text,
  admin_approved_at           timestamptz,
  admin_approved_by           uuid references public.users(id),
  rejection_reason            text,
  discovery_ui_mode           public.ui_mode not null default 'marketplace',
  display_theme               public.display_theme not null default 'light',
  notification_prefs          jsonb not null default '{}',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger set_brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute procedure public.set_updated_at();

alter table public.brand_profiles enable row level security;

-- Public sees active; owner sees own; admin sees all
create policy "brand_profiles_select"
  on public.brand_profiles for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "brand_profiles_insert"
  on public.brand_profiles for insert
  with check (user_id = auth.uid());

-- Owner updates profile fields; admin-only fields (status, admin_approved_*) via service role
create policy "brand_profiles_update_owner"
  on public.brand_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "brand_profiles_update_admin"
  on public.brand_profiles for update
  using (public.is_admin());

-- ============================================================
-- AGENT PROFILES
-- ============================================================

create table public.agent_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users(id) on delete cascade,
  status                public.profile_status not null default 'draft',
  agency_name           text,
  agent_full_name       text,
  years_in_industry     integer,
  sports_specialisms    text[] not null default '{}',
  geographic_regions    text[] not null default '{}',
  bio                   text,
  logo_url              text,
  website_url           text,
  linkedin_url          text,
  services_offered      text[] not null default '{}',
  commission_rate_display text,
  is_verified           boolean not null default false,
  verified_at           timestamptz,
  discovery_ui_mode     public.ui_mode not null default 'marketplace',
  display_theme         public.display_theme not null default 'light',
  notification_prefs    jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger set_agent_profiles_updated_at
  before update on public.agent_profiles
  for each row execute procedure public.set_updated_at();

alter table public.agent_profiles enable row level security;

create policy "agent_profiles_select"
  on public.agent_profiles for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "agent_profiles_insert"
  on public.agent_profiles for insert
  with check (user_id = auth.uid());

create policy "agent_profiles_update"
  on public.agent_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- REPRESENTATION LINKS
-- ============================================================

create table public.representation_links (
  id                     uuid primary key default gen_random_uuid(),
  agent_id               uuid not null references public.agent_profiles(id) on delete cascade,
  client_user_id         uuid not null references public.users(id) on delete cascade,
  -- client_role must be 'athlete' or 'team' — enforced by check constraint
  client_role            public.user_role not null,
  status                 public.link_status not null default 'pending',
  can_edit_profile       boolean not null default false,
  can_message            boolean not null default false,
  can_sign_contracts     boolean not null default false,
  commission_rate        text,
  contract_duration_months integer,
  requested_at           timestamptz not null default now(),
  accepted_at            timestamptz,
  terminated_at          timestamptz,
  termination_reason     text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint representation_links_client_role_check
    check (client_role in ('athlete', 'team'))
);

create trigger set_representation_links_updated_at
  before update on public.representation_links
  for each row execute procedure public.set_updated_at();

alter table public.representation_links enable row level security;

-- Agent or client can read the link
create policy "representation_links_select"
  on public.representation_links for select
  using (
    client_user_id = auth.uid()
    or agent_id in (
      select id from public.agent_profiles where user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Only agents can create representation links
create policy "representation_links_insert"
  on public.representation_links for insert
  with check (
    agent_id in (
      select id from public.agent_profiles where user_id = auth.uid()
    )
  );

-- Agent or client can update (for permissions/status changes)
create policy "representation_links_update"
  on public.representation_links for update
  using (
    client_user_id = auth.uid()
    or agent_id in (
      select id from public.agent_profiles where user_id = auth.uid()
    )
  );
