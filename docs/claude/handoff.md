---
plan: Phase 4 — Admin Dashboard
task: Phase 4 — COMPLETE (code done, Playwright blocked by missing env)
status: blocked_playwright
last_updated: 2026-05-27T15:00:00.000Z
head_sha: f374bb5
---

<current_state>
Phase 4 (Admin Dashboard) is fully implemented and committed. All unit tests pass (551 tests, 70 files). Type-check and lint are clean. The only failing check is `npx playwright test --project=chromium` — this is blocked by a missing `.env.local` file with Supabase credentials, NOT by any code issue. Docker is not installed, so local Supabase cannot be started.
</current_state>

<completed_work>

- lib/supabase/admin.ts: added getAllAthleteProfiles, getAllBrandProfiles, getAllUsers, getAllListings, getPendingCount, getAthleteProfileById, getBrandProfileById, updateProfileStatus ✅
- app/api/admin/profiles/[id]/route.ts: PATCH endpoint to approve/reject profiles (admin-only, service role key) ✅
- app/(admin)/layout.tsx: admin layout with role guard (redirects non-admins to /403) ✅
- app/(admin)/admin/dashboard/page.tsx: overview with pending counts, totals, quick actions ✅
- app/(admin)/admin/athletes/page.tsx: list all athletes with status filter tabs ✅
- app/(admin)/admin/athletes/[id]/page.tsx: athlete detail + ApproveRejectButtons ✅
- app/(admin)/admin/brands/page.tsx: list all brands with status filter tabs ✅
- app/(admin)/admin/brands/[id]/page.tsx: brand detail + ApproveRejectButtons ✅
- app/(admin)/admin/listings/page.tsx: list all job listings with status filter ✅
- app/(admin)/admin/users/page.tsx: list all users with role and joined date ✅
- components/admin/approve-reject-buttons.tsx: confirmation flow before PATCH call ✅
- components/admin/approve-reject-buttons.test.tsx: 5 tests, all passing ✅
- components/admin/status-badge.tsx: reusable colour-coded status badge ✅
- components/layout/nav-shell.tsx: admin nav updated (Dashboard, Athletes, Brands, Listings, Users) ✅
</completed_work>

<remaining_work>
To unblock Playwright:
1. Create `.env.local` from `.env.local.example` with real Supabase credentials (cloud project OR local with Docker Desktop installed)
2. Run `npx supabase start` to start local Supabase (requires Docker)
3. Re-run `npx playwright test --project=chromium`

Next phase (once env is set up): Phase 5 — could be:
- Landing page (public marketing page per spec Flow 1)
- Deals/contracts flow (proposal → negotiation → e-signature → payment)
- Notifications (email + push)
</remaining_work>

<decisions_made>

- Admin middleware: already implemented in middleware.ts (checks users.role === 'admin') — did NOT duplicate in layout; layout is an additional defence-in-depth check
- Brand approve: sets brand_profiles.status = 'active' (brand_status enum)
- Brand reject: sets brand_profiles.status = 'rejected' (brand_status enum)
- Athlete approve: sets athlete_profiles.status = 'active' (profile_status enum)
- Athlete reject: sets athlete_profiles.status = 'deactivated' (profile_status enum — 'rejected' not in profile_status, so 'deactivated' is used)
- NavShell admin nav updated to: Dashboard, Athletes, Brands, Listings, Users (replacing old Reports/Audit links that had no pages)
- updateProfileStatus uses createAdminClient (service role key) for the mutation — auth check happens first via createClient (anon key)
</decisions_made>

<blockers>
**Playwright blocked — infrastructure only, not code:**
- `npx playwright test --project=chromium` fails with "Timed out waiting 120000ms from config.webServer"
- Root cause: middleware.ts throws "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL" when any request arrives
- No `.env.local` exists; Docker is not installed (local Supabase can't start)
- Pre-existing condition — Playwright was never passing in this environment (brand.spec.ts from Phase 3 has the same requirement)
- Fix: create `.env.local` with real Supabase credentials
</blockers>

<context>
Phase 4 (Admin Dashboard) is code-complete. The marketplace now has full admin approval flows for athletes and brands. Admins can log in, see pending profiles, approve or reject them, view all users and listings.

The Playwright blocker is infrastructure (no Supabase credentials) not code. All 551 unit tests pass.
</context>

<next_action>
1. Create `.env.local` with Supabase credentials to unblock Playwright
2. Decide Phase 5: landing page, deals/contracts, or notifications
</next_action>
