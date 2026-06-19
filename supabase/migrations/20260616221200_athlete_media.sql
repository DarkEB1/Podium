-- ============================================================
-- B2 — ATHLETE MEDIA
-- Spec §3A.2 (profile photo + action photos), §3A.4 (availability).
-- Plan §1.5 B2.
--
-- Adds media columns to athlete_profiles. RLS unchanged (existing table:
-- policies in 20260419000002_profiles.sql already cover all columns).
-- All adds are idempotent (`if not exists`): profile_photo_url already
-- exists on the base table, so re-adding it is a no-op.
-- ============================================================

alter table public.athlete_profiles
  add column if not exists profile_photo_url text,
  add column if not exists action_photos     text[] not null default '{}',
  add column if not exists highlight_videos   text[] not null default '{}';

comment on column public.athlete_profiles.profile_photo_url is
  'Headshot/avatar URL (square crop). Uploaded via lib/storage presigned URL.';
comment on column public.athlete_profiles.action_photos is
  'Ordered gallery of action-shot URLs. Uploaded via lib/storage presigned URL.';
comment on column public.athlete_profiles.highlight_videos is
  'Ordered list of highlight video URLs (external embeds or uploaded clips).';

-- ============================================================
-- AVAILABILITY DISPLAY-LABEL AUDIT (no schema change)
-- ------------------------------------------------------------
-- Spec §3A.4: availability is stored as the public.availability_status enum
-- (defined in 20260419000001_users_auth.sql) and is DISPLAY-ONLY — there is
-- intentionally NO schema change here. The raw enum values must NEVER be
-- shown to users; every consumer that renders availability MUST map them to
-- these exact human-readable labels:
--
--   available_now -> 'Available Now'
--   available_from -> 'Available From [date]'   (interpolate available_from_date)
--   not_available -> 'Not Currently Taking New Work'
--
-- Consumer tasks responsible for rendering these labels (audit surface):
--   * Athlete profile card / detail            (AvailabilityBadge, §1.2 A5)
--   * Admin athlete view
--   * Brand discovery feed / marketplace card
-- The shared AvailabilityBadge primitive (components/ui/status-badges.tsx, A5)
-- is the single source of truth for this mapping; consumers must use it rather
-- than re-deriving labels.
-- ============================================================
