-- ============================================================
-- B1 — Athlete levels + NIL/seeking (plan §1.5 B1, spec §3A.3, §3A.6)
-- Extends the athlete_level enum, adds level-detail columns to
-- athlete_profiles, introduces the seeking_type (NIL) enum, and
-- converts athlete_profiles.seeking from text[] to seeking_type[].
-- RLS is unchanged (existing table — policies defined in 20260419000002).
-- ============================================================

-- ── athlete_level: extend 5 → 8 values (spec §3A.3) ─────────────
-- ADD VALUE IF NOT EXISTS is idempotent and re-runnable.
alter type public.athlete_level add value if not exists 'university_bucs';
alter type public.athlete_level add value if not exists 'academy';
alter type public.athlete_level add value if not exists 'national';

-- ── seeking_type: the 10 NIL deal categories (spec §3A.6) ───────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeking_type') then
    create type public.seeking_type as enum (
      'product_gifting',
      'paid_partnership',
      'brand_ambassador',
      'social_content',
      'event_appearance',
      'affiliate_code',
      'equipment_sponsorship',
      'nutrition_supplement',
      'apparel_deal',
      'university_nil_collective'
    );
  end if;
end
$$;

-- ── athlete_profiles: level-detail columns (spec §3A.3) ─────────
alter table public.athlete_profiles
  add column if not exists university_team   text;
alter table public.athlete_profiles
  add column if not exists highest_level     public.athlete_level;
alter table public.athlete_profiles
  add column if not exists academy_club      text;
alter table public.athlete_profiles
  add column if not exists national_programme text;

-- ── athlete_profiles.seeking: text[] → seeking_type[] (spec §3A.6)
-- Existing rows default to '{}'; the cast is empty-safe. The default
-- is dropped first so the column-type change is not blocked by it,
-- then re-applied as a typed empty array.
alter table public.athlete_profiles
  alter column seeking drop default;
alter table public.athlete_profiles
  alter column seeking type public.seeking_type[]
    using seeking::text[]::public.seeking_type[];
alter table public.athlete_profiles
  alter column seeking set default '{}'::public.seeking_type[];
alter table public.athlete_profiles
  alter column seeking set not null;
