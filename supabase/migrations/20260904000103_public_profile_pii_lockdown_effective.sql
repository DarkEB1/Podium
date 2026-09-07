-- WS-SEC-01 (P0) — EFFECTIVE anon PII/financial lockdown.
--
-- 20260904000101 attempted `revoke select (sensitive_cols) ... from anon`, but the
-- `anon` role holds a TABLE-LEVEL select grant on the four profile tables. In
-- PostgreSQL a column-level REVOKE does not remove a privilege held via a
-- table-wide grant, so that revoke was a silent no-op: a direct PostgREST anon
-- request (e.g. select=full_legal_name) still returned the sensitive columns.
-- Verified live on staging: has_table_privilege('anon', ...) = true and anon
-- still had SELECT on full_legal_name / payout_account_last4 / stripe_connect_account_id.
--
-- Correct fix: drop the table-wide SELECT from anon, then GRANT SELECT only on the
-- app's declared public column set (lib/supabase/profiles.ts PUBLIC_PROFILE_COLUMNS).
-- RLS still limits anon to status='active' rows; this limits anon to safe COLUMNS.
-- `authenticated` is intentionally untouched here (owners read their own payout/
-- guardian columns as authenticated, and updateProfile ... returning * needs it) —
-- closing the authenticated base-table read is a separate, larger change (relocate
-- owner sensitive-column reads to the service role) tracked as a follow-up.
-- service_role (BYPASSRLS) is unaffected by grants.

-- athlete_profiles
revoke select on public.athlete_profiles from anon;
grant select (
  id, user_id, status, display_name, profile_photo_url, primary_sport,
  secondary_sport, position, level, highest_level, years_active, height_cm,
  weight_kg, notable_achievements, performance_stats, social_accounts, home_city,
  home_country, travel_radius_km, availability_status, available_from_date,
  has_agent, seeking, is_seeking, action_photos, highlight_videos, academy_club,
  national_programme, university_city, university_country, university_team,
  last_active_at, created_at, updated_at
) on public.athlete_profiles to anon;

-- team_profiles
revoke select on public.team_profiles from anon;
grant select (
  id, user_id, status, team_name, nickname, sports, competition_level,
  year_founded, logo_url, cover_photo_url, bio, home_city, home_country,
  home_venue, match_day_attendance, fan_reach, social_accounts,
  total_social_following, press_mentions, seeking_sponsorship_types,
  total_sponsorship_value_sought, annual_sponsorship_target,
  sponsorship_brief_url, media_pack_url, offers_to_sponsors, created_at,
  updated_at
) on public.team_profiles to anon;

-- brand_profiles
revoke select on public.brand_profiles from anon;
grant select (
  id, user_id, status, company_name, trading_name, industry, description,
  headquarters_city, headquarters_country, website_url, linkedin_url,
  social_accounts, logo_url, cover_image_url, seeking, target_sports,
  target_level, geographic_preference, created_at, updated_at
) on public.brand_profiles to anon;

-- agent_profiles
revoke select on public.agent_profiles from anon;
grant select (
  id, user_id, status, agency_name, agent_full_name, years_in_industry,
  sports_specialisms, geographic_regions, bio, logo_url, website_url,
  linkedin_url, services_offered, commission_rate_display, is_verified,
  verified_at, verification_status, created_at, updated_at
) on public.agent_profiles to anon;
