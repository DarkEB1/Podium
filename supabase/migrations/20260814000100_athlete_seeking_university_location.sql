-- UI fixes round 2 (UI-revamp doc):
-- 1. is_seeking: quick "seeking opportunities" toggle, default seeking so new
--    athletes are discoverable from day one. Existing rows backfill to true
--    via the column default.
-- 2. university_city / university_country: term-time location for student
--    athletes, captured alongside home_city / home_country.
alter table public.athlete_profiles
  add column if not exists is_seeking boolean not null default true,
  add column if not exists university_city text,
  add column if not exists university_country text;
