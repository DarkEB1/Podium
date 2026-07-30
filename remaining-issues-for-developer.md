# Remaining Issues for Developer

Prepared after merging your "Pre-launch remediation (Phases 1-3)" commit (`6d69b09`) into the local branch, applying all 22 new migrations to the live Supabase project, and re-verifying every item from the earlier audit directly against the current code. This list only contains what is confirmed still open. Anything the remediation already fixed has been dropped from this list, not restated.

Everything below was checked by reading the actual code and running the actual test suite today, not carried forward as an assumption.

---

## 1. Local commits not yet on your repo

Thirteen commits exist locally on this machine that are not on `github.com/DarkEB1/Podium`. They cannot be pushed directly since this account does not have write access to your repo.

**A git bundle containing all 13 commits is included alongside this file: `docs/handoff/podium-local-changes.bundle`.** A bundle is a self-contained file that carries the full commit history, including the merge commits, exactly as it exists here. Applying it is a normal `git pull` pointed at the file instead of at a remote URL, no collaborator access needed on either side.

**To apply it, on a checkout of your own `main` (already containing `6d69b09`):**

```
git pull /path/to/podium-local-changes.bundle main
```

This fast-forwards or merges the 13 commits onto your `main` exactly as they exist here. If you get a "refusing to merge unrelated histories" message for any reason, add `--allow-unrelated-histories`, though that should not be necessary since the bundle's own ancestor commits (`6d69b09`, `d6b76b7`, and two earlier commits already on your `main`) are all already present in your history.

After pulling, review the diff before pushing, particularly commit `2831829`, which is the merge of your remediation into this local history and includes 8 resolved file conflicts (all resolved in favour of your versions) plus one deleted file (`lib/notifications/email.ts`, dead code that only ever existed in this local fork). The final commit, `a5d8418`, simply regenerates `types/database.ts` after the 22 migrations were applied, matching your own project convention of regenerating types after every migration. Everything else in the list below is unchanged from your own commits.

In commit order (oldest first):

- `f374bb5` feat(admin): Phase 4 admin dashboard, approve/reject athletes and brands
- `095dec2` chore: update stop hook, handoff, and bump Supabase deps
- `5ba34ae` fix(e2e): unblock all 55 Playwright tests
- `b4ec8cc` feat: Phase 5, deals UI, contract signing, and email notifications
- `91f3279` docs: update handoff to Phase 5 complete
- `3aa9b06` fix(deals): replace broken HTML form POSTs with client-component fetch calls
- `0dd03be` merge: pulled your styling and feature work from origin/main at the time
- `47cdbb4` fix: admin layout own nav, update nav-shell test for Deals link
- `9a96e43` fix(nav): point broken Profile/Clients/CTA links to existing pages
- `a64d6a6` fix(landing): point "How it works" link to `#how` instead of a dead `/auth/login` route (superseded by your own later fix in `6d69b09`, kept for history)
- `405bc24` merge: pulled your handoff docs commit
- `2831829` merge: pulled and integrated your Phase 1-3 remediation commit, resolving 8 file conflicts in favour of your versions, removing one dead file (`lib/notifications/email.ts`, an early local build of email sending that only ever existed in this local history and was never on your branch, fully superseded by your `lib/email` system), regenerating `package-lock.json`, and applying the 22 pending migrations to the live Supabase project
- `a5d8418` chore: regenerate `types/database.ts` to match the schema after the 22 migrations were applied

**What needs to happen:** either add this GitHub account as a collaborator so it can push directly, or have this work sent to you as a diff/patch/zip for you to apply and push yourself. The only functionally new work in that list beyond what you already have is the Phase 4 admin dashboard, the Phase 5 deals/e-signature work, and the admin nav fix, all of which predate your remediation commit and were built independently before your branch and this one diverged. Worth a direct comparison with your own `main` to confirm nothing in Phase 4/5 duplicates or conflicts with equivalent work already on your side.

---

## 2. Confirmed still-open launch blockers

### 2.1 Teams still cannot message anyone or complete a deal

Your remediation removed the dead `/team/messages` link from the nav (correct short-term fix, the 404 is gone), but the underlying page was never built. Confirmed directly in `lib/routes.ts`:

```
// NOTE: teams have no messaging surface yet, there is no /team/messages
// page or chat route. Add them here once those pages exist, until then the
// team nav deliberately does not offer a Messages destination (B-4).
```

`app/(team)/team/` still contains only `dashboard`, `discover`, `onboarding`, `profile`, `settings`. No messages, deals, requests, or saved pages exist. A team can browse brand sponsorship listings but has no way to message a brand, receive a proposal, sign a contract, or receive payment. This is the same functional gap as before, just no longer visible as a broken link. If teams are expected to transact at launch, this still needs building, most straightforwardly by porting the equivalent athlete pages (`athlete/messages`, `athlete/deals`, `athlete/requests`) to the team route group.

### 2.2 Brands still cannot discover or search teams at all

Confirmed: `lib/supabase/profiles.ts` has no `getActiveTeamProfiles` (or equivalent) function. `app/(brand)/brand/discover/page.tsx` only imports `getActiveAthleteProfilesPage`. A brand paying for a subscription has no way to find a team to sponsor, in any form, through the UI. Combined with 2.1, the team side of the marketplace is not reachable from either direction yet.

### 2.3 Under-18 guardian consent is still collected but never enforced

`components/athlete/guardian-form.tsx` still only captures guardian details and saves them. Confirmed via direct grep: `lib/supabase/deals.ts` still has zero references to "guardian" anywhere in the file. There is still no consent email, no accept flow, and no gate on `signContract` or proposal acceptance for an athlete under 18. This is flagged as a legal liability in your own `docs/claude/lessons.md`. Not touched by this remediation pass.

### 2.4 No admin two-factor authentication

Confirmed via grep across `app/(admin)`: still zero matches for TOTP, 2FA, or any related term. Admin access remains a role check only. Not touched by this remediation pass.

### 2.5 Three of the five originally-specified cron jobs are still missing

`app/api/cron/` now contains `gdpr-deletion`, `maintenance`, and `reconcile-subscriptions`, real progress. But `maintenance` only purges expired rate-limit rows; it is not a consolidated replacement for the others. Still missing: chat auto-clear (spec Flow 43), guardian-consent-expiry purge for abandoned under-18 signups (spec Flow 18), and the 18th-birthday control-transfer job (spec Flow 18). None of these three exist anywhere in `app/api/cron/`.

---

## 3. Newly found this pass

### 3.1 Swipe Mode toggle exists in Settings but does nothing

`components/athlete/settings-form.tsx` has a working "Swipe mode" switch that saves a real preference (`ui_mode`) to the database. `app/(brand)/brand/discover/page.tsx` even fetches that preference back via `getDiscoveryUiMode`, but the fetched value is never read again after that line, the page always renders the same `AthletesBrowser` marketplace-grid component regardless of what the user chose. A user who toggles this on will see no change at all. This is arguably worth fixing before launch even as a stopgap (either hide the toggle until Swipe Mode is built, or wire the existing preference to at least something), since a setting that silently does nothing is a worse user experience than not offering the setting.

---

## 4. Confirmed still-open spec gaps (unchanged from before, re-verified today)

These were re-checked directly against the current code, not assumed carried-over.

| Item | Status |
|---|---|
| User-level two-factor authentication (TOTP) | Still absent, no `otplib`/`speakeasy` dependency, no lib code |
| Stripe Connect (athlete payouts, saved cards) | Still absent, no matching functions anywhere in `lib/stripe/` |
| GDPR data export ("Download my data") | Still a stub, `requestDataExport()` in `lib/supabase/settings.ts` inserts a request row and nothing fulfils it. Note this is distinct from GDPR erasure (account deletion), which your remediation did build |
| Verification badge system | Still absent, no admin review queue found anywhere in `app/(admin)` |
| DocuSign or HelloSign integration | Still absent, e-signature remains the in-house click-to-sign button |
| Sessions and login history population | Still absent, no `recordLogin`/`upsertSession`-equivalent writer functions found in `lib/supabase/auth.ts` |
| Notification dispatch, push channel specifically | Email is now real (this remediation built it). Push notifications still have no transport |
| Matching and scoring algorithm (spec Section 10) | Still absent, `lib/supabase/discovery.ts` has no scoring logic of any kind |
| Admin module coverage | Still the same subset as before: dashboard, athletes, brands, listings, users. Still missing Reports/Trust Queue, Verification Management, Payments and Revenue view, Subscription Management, Audit Logs, Analytics, System Configuration |
| Social account OAuth (Instagram, TikTok, X, YouTube, LinkedIn) | Still absent, manual handle entry only |

---

## 5. Accounts and credentials still needed

- **Resend**: the email system is now fully built and wired in, but `RESEND_API_KEY` and `EMAIL_FROM` are not set in `.env.local` at all right now. Until they are, every email silently no-ops (this is by design, logged as "skipped", not an error, but it means no verification emails, no password resets, nothing is actually being sent in this environment today). This is now the single highest-value account to set up, since the code is ready and waiting on it.
- **KYC/identity verification provider** (Stripe Identity, Persona, or Onfido): still needed if the Verification Badge feature is built out.
- **Companies House API access**: still needed for automated brand legitimacy checks, if that stays in scope.
- **Social platform developer apps** (Meta, TikTok, X, YouTube, LinkedIn): still needed if social OAuth connection is built, budget real review time for each.
- **Push notification provider** (Web Push or FCM): still needed, email is covered now but push is not.
- **DocuSign or HelloSign account**: still needed only if you decide to replace the in-house signer with a real e-signature provider, worth a decision either way rather than leaving the env vars in `.env.local.example` unused indefinitely.

---

## 6. What's confirmed working now and doesn't need to be raised again

Listed briefly so this reads as a punch list, not a re-litigation of the whole audit: the inverted 300-character connection-request message bug is fixed and has a dedicated migration and test. Brand-to-athlete connection requests work (`/brand/discover/[userId]` now exists with a working connect flow). Agent discovery and client management now exist (`/agent/clients`, `/agent/clients/new`, `/agent/profile/[userId]`). Terms of Service, Privacy Policy, and Cookie Policy pages are live with a working cookie consent banner. GDPR account erasure has a real migration, a real cron job, and is authorisation-hardened. Rate limiting is live on auth and state-changing routes. The landing page's previously fabricated trust metrics were replaced with honest, verifiable copy. Storage buckets exist in the live Supabase project. All 2021 tests pass, type-check is clean, lint is clean.

---

*This reflects the state of the code as merged and migrated today. Re-verify anything here against current `main` before acting on it if meaningful time has passed.*
