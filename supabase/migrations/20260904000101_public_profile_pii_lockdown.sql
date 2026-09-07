-- ============================================================
-- WS-SEC-01 — PII + financial leak on the public profile surface
-- ============================================================
--
-- The four *_profiles SELECT policies are `status = 'active' or owner or admin`
-- (supabase/migrations/20260419000002_profiles.sql). They restrict which ROWS a
-- caller sees but say nothing about which COLUMNS, and RLS cannot: it is
-- row-level only. So every active row was fully readable — full_legal_name,
-- date_of_birth, phone, guardian_* (minors), payout_*/stripe_connect ids on
-- athletes; commercial-manager and primary-controller contact details on teams;
-- company_registration_number and vat_number on brands — including LOGGED OUT
-- with the public anon key, straight through PostgREST:
--
--   GET /rest/v1/athlete_profiles?status=eq.active
--       &select=full_legal_name,payout_account_last4,guardian_email
--   apikey: <anon key that ships to every browser>
--
-- The application half of the fix is `getPublicProfile`'s explicit per-role
-- column projection (lib/supabase/profiles.ts). This migration is the PostgREST
-- half: column-level REVOKE so the anon role cannot read the sensitive columns
-- no matter how the request is shaped.
--
-- Scoped to `anon` deliberately. Column privileges in Postgres are per-ROLE, not
-- per-row, so they cannot say "the owner may read their own payout details but
-- not anyone else's". A logged-in owner acts as the `authenticated` role
-- (createClient() in lib/supabase/server.ts uses the anon key + the user's
-- session cookie), and reads their OWN sensitive columns as `authenticated`
-- (the athlete settings page loads them via getOwnProfile → select('*')), as
-- does every owner UPDATE ... RETURNING *. Revoking these columns from
-- `authenticated` would therefore break owner self-service and profile writes.
-- The demonstrated P0 — an unauthenticated reader with the anon key — is fully
-- closed here. Closing the residual (a *logged-in* user reading another active
-- user's sensitive columns via a hand-crafted PostgREST select) additionally
-- requires relocating owner sensitive-column reads/writes to the service role,
-- then revoking from `authenticated` too; that is a larger change tracked as a
-- follow-up and is NOT what the reported exploit uses.
--
-- `service_role` (server-side reads/writes, webhooks, admin tooling) is a
-- BYPASSRLS superuser-equivalent and is unaffected by column grants.

-- ── athlete_profiles: identity/contact PII + payout + Stripe Connect ─────────
revoke select (
  full_legal_name,
  date_of_birth,
  is_under_18,
  phone,
  guardian_name,
  guardian_relationship,
  guardian_email,
  guardian_phone,
  guardian_accepted_at,
  payout_method,
  payout_bank_name,
  payout_account_holder,
  payout_account_last4,
  payout_sort_code_last4,
  payout_country,
  stripe_connect_account_id,
  stripe_connect_status,
  stripe_connect_onboarded_at,
  chat_retention_days,
  notification_prefs
) on public.athlete_profiles from anon;

-- ── team_profiles: commercial-manager + primary-controller contact PII ───────
revoke select (
  commercial_manager_name,
  commercial_manager_email,
  commercial_manager_phone,
  primary_controller_name,
  primary_controller_role,
  primary_controller_email,
  primary_controller_phone,
  notification_prefs
) on public.team_profiles from anon;

-- ── brand_profiles: company registration + VAT + admin-review bookkeeping ────
revoke select (
  company_registration_number,
  vat_number,
  admin_approved_at,
  admin_approved_by,
  rejection_reason,
  notification_prefs
) on public.brand_profiles from anon;

-- ── agent_profiles: private preferences (no contact PII columns here) ────────
revoke select (
  notification_prefs
) on public.agent_profiles from anon;
