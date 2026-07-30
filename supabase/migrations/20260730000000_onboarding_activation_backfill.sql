-- ============================================================
-- QA-1.1 / QA-1.2 — TEAM AND AGENT ONBOARDING ACTIVATION BACKFILL
--
-- team_profiles.status and agent_profiles.status both default to 'draft', and
-- middleware treats any 'draft' profile as onboarding-in-progress. Neither
-- role's onboarding ever moved the status on, so every team and agent that
-- signed up was redirected back into onboarding forever.
--
-- The code fix is in lib/supabase/teams.ts (insert as 'active') and
-- app/(agent)/agent/onboarding/page.tsx (publish after create). This migration
-- rescues the rows created before that fix.
--
-- Safe to backfill unconditionally: team and agent onboarding are both single
-- forms that persist only on submit, so an existing row is always a completed
-- submission, never a partial draft. 'suspended' rows are left alone so an
-- admin action is not undone.
-- ============================================================

update public.team_profiles
   set status = 'active'
 where status = 'draft';

update public.agent_profiles
   set status = 'active'
 where status = 'draft';
