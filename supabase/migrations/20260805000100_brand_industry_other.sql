-- ============================================================
-- QA-2 — brand_profiles.industry_other
-- ============================================================
--
-- The brand onboarding form has always shown a "Please specify your industry"
-- input when Industry is set to 'Other', and has always sent the answer as
-- `industry_other`. No such column existed, so PostgREST rejected the UPDATE
-- with PGRST204 and the ENTIRE step 2 save (industry, seeking, target sports,
-- target level, geography) failed with the generic "We could not save those
-- details" message. A brand that picked 'Other' and typed anything could not
-- get past Targeting at all.
--
-- Additive and nullable, so it is backward compatible with the code currently
-- live: existing rows get NULL, and a deploy that predates the form change
-- simply never writes it.

alter table public.brand_profiles
  add column if not exists industry_other text;

comment on column public.brand_profiles.industry_other is
  'Free-text industry, set only when industry = ''other''. The form clears it when the industry changes away from other.';
