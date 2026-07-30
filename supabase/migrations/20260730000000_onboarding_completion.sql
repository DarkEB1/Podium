-- ============================================================
-- Onboarding completion, made explicit per role
-- ============================================================
--
-- The bug this fixes: middleware decided "has this user finished onboarding?"
-- with one shared expression, `status <> 'draft'`, applied to all four role
-- tables. That expression is wrong for three of the four roles:
--
--   * team / agent — `profile_status` defaults to 'draft' and nothing in either
--     single-form flow ever moved it off 'draft'. So the gate bounced every
--     navigation back into onboarding, the onboarding page saw an existing row
--     and redirected out again, and the two redirects chased each other
--     forever. A team or agent could not complete signup at all.
--
--   * brand — `brand_status` has no 'draft' value (see 20260419000001), so the
--     expression was vacuously true from the instant step 1 of the four-step
--     wizard inserted the row. A brand could leave the wizard after step 1 with
--     no industry, description, target sports or seeking preferences set, and
--     the gate would never ask them to come back.
--
-- Only athlete was correct, because athlete onboarding ends in a real publish
-- step that sets status = 'active'.
--
-- The fix has two halves. Code side: team and agent rows are now created
-- 'active', because for a single-form flow submitting the form *is* publishing.
-- Schema side (here): brands get an explicit completion timestamp, because
-- brand `status` is admin-controlled (pending_approval -> active on approval)
-- and therefore cannot double as a "user finished the wizard" flag.

-- ── Brands: an explicit "finished the wizard" marker ────────────────────────
-- Nullable by design: null means still in the wizard. Set by
-- POST /api/profiles/me/onboarding-complete when the brand submits step 4.
-- Deliberately NOT the same thing as `status`: a brand can have finished
-- onboarding (this column set) and still be awaiting admin approval
-- (status = 'pending_approval'). Conflating the two is what caused the bug.
alter table public.brand_profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.brand_profiles.onboarding_completed_at is
  'When the brand submitted the final onboarding step. Null means still in the wizard. Distinct from status, which tracks admin approval.';

-- Every brand row that already exists predates this column. Backfill them all
-- to created_at rather than leaving them null: under the old (vacuously true)
-- gate every one of these brands was already being treated as onboarded and
-- allowed into the app, so leaving them null would suddenly trap existing
-- brands back inside a wizard they had walked away from months ago. New rows
-- start null and must earn the timestamp.
update public.brand_profiles
   set onboarding_completed_at = created_at
 where onboarding_completed_at is null;

-- ── Teams and agents: release the rows the loop stranded ────────────────────
-- A 'draft' row in either table is only reachable via the bug: both flows
-- persist exactly once, on submit, so there is no legitimate partial state to
-- preserve. Every one of these users completed their form and was then locked
-- out, so promoting them to 'active' is what they already asked for.
update public.team_profiles
   set status = 'active'
 where status = 'draft';

update public.agent_profiles
   set status = 'active'
 where status = 'draft';
