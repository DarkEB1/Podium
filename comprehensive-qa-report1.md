# Podium Comprehensive QA Report

Prepared as an exhaustive pass across the whole application: every account type's full lifecycle, connections and messaging in every role direction, the complete deal and contract pipeline, the entire batch of newly-built features from the last remediation (2FA, Stripe Connect, verification badges, push, social OAuth, GDPR export), the admin portal, and background jobs.

This supersedes and folds in every finding from the earlier `bug-deep-dive.md`, all re-verified during this pass, plus a substantial number of new findings from testing far beyond the two flows that document originally covered.

**How to read this document:** every finding states plainly whether it was confirmed live (a real request against the real running app and database), confirmed via direct code reading, or retracted after further verification proved an earlier observation wrong. Two significant retractions are documented in full, not hidden, because understanding why they happened matters for trusting everything else here.

---

## 0. Executive Summary

**Eight confirmed critical bugs**, plus four further confirmed issues of medium severity and one low-severity robustness gap, were found across the account lifecycle, the messaging system, the contract pipeline, the notification system, and the GDPR data export feature.

Three of the four non-athlete roles (team, brand, agent) cannot currently complete signup and reach their own account. Free-text messaging never actually unlocks for any match, for any pairing, under any circumstances, because the mechanism that is supposed to flip it on is never called by any real code path. No transactional email has ever been sent to any user for any event, because the row every email send depends on to check notification preferences is never created for anyone. GDPR data export is permanently broken for every user due to a storage configuration mismatch. Contracts never become legally "locked" after both parties sign.

Against that, a large amount of the product works correctly and was verified working, not assumed: athlete onboarding end to end, the full deal negotiation and multi-party e-signature pipeline itself (once messaging is set aside), connection requests and duplicate prevention, admin 2FA and user 2FA (both enrollment and enforcement), all twelve admin pages, five of six background cron jobs, push subscription storage, and the fail-closed behaviour of every feature still waiting on a third-party account (Stripe Connect, social OAuth).

A methodology note matters here: partway through this pass, the browser automation environment was found to give unreliable results specifically for page navigation and redirects (a stale client-side cache issue), while direct API calls and direct database queries remained reliable throughout. Two significant findings were caught, tested a second way, and retracted or corrected as a result. This is disclosed in full in section 5, because it is exactly the kind of thing that would otherwise quietly inflate a bug list with false positives.

---

## 1. Critical Bugs

### 1.1 Team signup: profile creates successfully, then the account can never be reached again

**Confirmed live**, twice (once via browser observation, then re-confirmed cleanly via direct HTTP requests with a session cookie, bypassing the browser entirely).

A team completes the onboarding form, including logo and cover image, and submits. The server responds 200 and a "Team profile created" success message appears. From that point on, the team can never reach their dashboard, their settings page, or anywhere else. `GET /team/dashboard` correctly redirects to `/team/onboarding` (as coded, since the account is not "complete"), but `GET /team/onboarding` itself, despite the team's profile now existing, returns the onboarding form again (a clean 200) instead of redirecting to `/team/settings` as its own code says it should.

**Root cause:** `team_profiles.status` is `not null default 'draft'` (`supabase/migrations/20260419000012_team_agent_buildout.sql`). `createTeamProfile()` (`lib/supabase/teams.ts:49-67`) never sets `status`, so every team profile is created and stays in `'draft'` forever. Middleware's onboarding-complete check is a single shared rule applied to every role: `status !== 'draft'`. Since team status never changes, the account is permanently considered incomplete. Unlike athletes, whose onboarding wizard has a distinct final "publish" step (`app/api/profiles/me/publish/route.ts`, backed by `publishProfile()` in `lib/supabase/profiles.ts:128`, which does `.update({ status: 'active' })`), team onboarding has no equivalent call anywhere in the codebase.

**Fix:** have `createTeamProfile()` insert with `status: 'active'` directly, or call the existing publish flow immediately after creation succeeds in the server action inside `app/(team)/team/onboarding/page.tsx`.

**Severity: Critical.** A team cannot use the product past sign-up.

### 1.2 Agent signup: the identical bug

**Confirmed live**, via the same clean curl-based method used to re-verify 1.1.

`agent_profiles.status` is defined identically (`not null default 'draft'`, `supabase/migrations/20260419000002_profiles.sql:212`). `lib/nav/config.ts` configures the onboarding-completion check for agents exactly the same way as teams: `ONBOARDING_PROGRESS_COLUMNS.agent = 'status'`. Grepping the entire codebase for any call to a publish endpoint from agent onboarding turns up nothing. Tested cleanly: `GET /agent/dashboard` with a valid session for an agent whose profile exists correctly redirects (307) to `/agent/onboarding`, and `GET /agent/onboarding` itself returns a plain 200 (the onboarding form again) instead of redirecting to `/agent/profile` as its own code (`if (existing) redirect(ROUTES.agent.profile)`) says it should.

**Fix and severity: identical to 1.1.**

### 1.3 Brand signup: profile creation crashes if LinkedIn is left blank, with zero feedback

**Confirmed live**, with a full server-side stack trace.

Brand onboarding step 1 labels the LinkedIn field "(optional)". Leaving it blank and clicking Next shows "Saving…" then silently reverts with no error message of any kind.

**Root cause, three layers, all confirmed:**
1. **Database:** `brand_profiles.linkedin_url` is `text not null` with no default (`supabase/migrations/20260419000002_profiles.sql:160`). The only column across all four profile tables with this exact shape (checked athlete, team, and agent profiles specifically; none have this problem, so it is not a systemic pattern).
2. **Frontend disagrees:** `components/brand/brand-profile-form.tsx:49` defines the field as `z.string().url(...).optional().or(z.literal(''))`, explicitly optional, explicitly allowing empty.
3. **The API makes it worse:** `app/api/profiles/me/route.ts` catches the specific `PROFILE_ALREADY_EXISTS` error but does a bare `throw err` for everything else, so Next.js returns an empty, non-JSON 500. The client's own `onSubmit` (`components/brand/brand-profile-form.tsx:260-261`) calls `res.json()` unconditionally without checking `res.ok`, so it then throws a second, unrelated `SyntaxError` parsing the empty body, which is what actually gets caught and silently swallowed.

**Extends further than first thought:** re-tested this same error-handling gap during athlete testing (by accident, via a genuine test-data mistake sending an invalid enum value to the athlete profile PATCH endpoint) and confirmed the identical bare `throw err` pattern exists on the PATCH (update) path too, not just POST (create). This means any invalid data of any kind sent to `/api/profiles/me`, for any of the four roles, produces the same silent, unexplained 500.

**Fix:** either drop the `not null` constraint on `linkedin_url` (matching the form's own stated intent) or make the form actually require it. Separately and more importantly, `app/api/profiles/me/route.ts`'s catch block should handle any `ProfileError` generically and return a real `NextResponse.json({ error: {...} }, { status: 400 })` for both POST and PATCH, and `brand-profile-form.tsx`'s `onSubmit` should check `res.ok` before calling `.json()`.

**Severity: Critical.**

### 1.4 Free-text messaging never unlocks for any match, ever, for any role pairing

**Confirmed live, rigorously, with database verification at every step.** One of the two most severe findings in this report.

The product's data model and the spec both establish a mandatory mechanic: a brand must send a formal proposal before free-text chat opens up (`matches.proposal_required` / `matches.proposal_sent`). Tested exactly as a real user would:

1. Athlete attempts a text message before any proposal exists: correctly blocked with a clean 403 `PROPOSAL_REQUIRED`. This half works.
2. Brand sends a real proposal through the actual endpoint the real UI calls (`POST /api/deals/proposals`): succeeds, a genuine `proposals` row is created.
3. Checked the match's `proposal_sent` flag directly in the database: still `false`.
4. Athlete retries the identical text message: still blocked with the identical 403.

**Root cause, confirmed by reading every relevant file, not guessed:**
- `lib/supabase/messaging.ts` only ever flips `matches.proposal_sent = true` as a side effect inside `sendMessage()`, specifically when a message is sent with `content_type: 'proposal_card'`.
- `lib/supabase/deals.ts`'s `sendProposal()`, called by the real `/api/deals/proposals` POST endpoint, only inserts into the `proposals` table. It never touches `matches.proposal_sent` and never calls `sendMessage`.
- `components/brand/proposal-form.tsx`, the actual UI component a brand uses, calls only `/api/deals/proposals`. It never sends a `proposal_card` message.
- The proposal respond (accept/decline) and counter endpoints were checked too: neither touches `proposal_sent` or calls `sendMessage` either.
- A migration comment (`supabase/migrations/20260720005005_match_integrity.sql`) documents the intended design in plain words: *"proposal_sent (flipped by sendMessage in lib/supabase/messaging.ts:192)"*, confirming this was always meant to work this way, it just never got wired up to any real user action.

**There is no code path in the entire application, used by any real user, that ever sets `matches.proposal_sent = true`.** This does not block the structured deal pipeline itself (accept, counter, decline, contract, and signing all go through their own dedicated endpoints, verified independently working, see 1.6), but the ordinary chat between a brand and an athlete or team never opens, contradicting the spec's explicit design at every mention of it, and leaving users with no way to have a normal conversation at any point in a deal.

**Fix:** either have `POST /api/deals/proposals` also flip `matches.proposal_sent = true`, or have `proposal-form.tsx` additionally send a `proposal_card` message through the messaging endpoint when a proposal is created.

**Severity: Critical. Affects every match, every pairing, across the entire product.**

### 1.5 No transactional email has ever been sent to any user, for any event

**Confirmed live and confirmed universal.** The other of the two most severe findings in this report, found while investigating an unrelated issue and then run down fully.

Every notification-triggering action tested this session (a connection request being received, a connection being accepted, a proposal being received) produced the identical logged exception every single time:

```
SettingsError: Cannot coerce the result to a single JSON object
    at getSettings (lib/supabase/settings.ts:44)
    at emailAllowed (lib/email/index.ts:51)
    at sendTransactionalEmail (lib/email/index.ts:68)
```

**Root cause:** `getSettings()` (`lib/supabase/settings.ts:48-63`) queries `profile_settings` with `.single()`, which throws unless exactly one row is found. Checked whether any code anywhere ever creates this row for a user: nothing does. The table has an `updated_at` trigger and an RLS insert policy, but no insert trigger and no application code path that ever writes the initial row (checked every reference to `profile_settings` in the codebase). Confirmed directly against the database with no filter at all: **zero rows exist in `profile_settings`, for any user, in the entire system.**

`sendTransactionalEmail()` does catch this error (`lib/email/index.ts:175`, a deliberate design so "a failure in the email path must never break the caller's transaction"), which is why the connection requests, acceptances, and proposals themselves all still succeeded normally throughout this testing pass. But the practical consequence is total: **`emailAllowed()` throws before it can ever determine whether an email should send, for every event, for every user, so no transactional email has ever actually been delivered by this system**, independent of and in addition to Resend not yet being configured. Once Resend is set up, this bug alone would still prevent every single email the spec promises (connection requests, matches, proposals, contracts, payments) from ever going out.

**Fix:** create a `profile_settings` row for every user at the point their account or role is created (mirroring the pattern used for the other per-user tables that do have this covered), or have `getSettings()` fall back to sensible defaults via `.maybeSingle()` instead of throwing when no row exists yet.

**Severity: Critical.** Every promised notification email in the entire product silently never sends, for every user, right now.

### 1.6 Contracts never actually get "locked," and the signature audit trail is never captured

**Confirmed live.** The deal pipeline itself, tested end to end with a real team/brand match: proposal sent, accepted, contract auto-created (`pending_brand_signature`, with a correctly embedded terms snapshot), brand signs (`pending_athlete_signature`), team signs (`fully_signed`). This part works.

But reading `signContract()` (`lib/supabase/deals.ts:298-377`) end to end and checking the resulting data revealed three related gaps:

1. **No signer IP or device is ever captured.** The function's signature is `(supabase, adminSupabase, contractId, userId)`, no request metadata passed in anywhere. The columns `brand_signer_ip`, `brand_signer_device`, `athlete_signer_ip`, `athlete_signer_device` exist and were confirmed `null` after a real signature. Spec 11.6 explicitly requires "full audit trail per signature event: signer ID, IP, device fingerprint, timestamp, geolocation"; only the timestamp half exists.
2. **`locked_at` is never set**, confirmed live: a contract reached `fully_signed` status with `locked_at` still `null`. The spec is explicit that "once both parties have signed: contract locked, immutable, unmodifiable via platform." Nothing in `signContract()` ever references or assigns this column.
3. **Consequently `retain_until` never gets computed either.** A working database trigger correctly computes `retain_until = locked_at + interval '7 years'` whenever `locked_at` transitions from null to set (`supabase/migrations/20260419000005_deals.sql`), but since `locked_at` never gets set, this never fires. The GDPR erasure logic explicitly depends on `retain_until` to decide how long a contract must be kept before it becomes eligible for purge; with this value always null for every contract, that retention decision cannot be evaluated correctly for anyone.

**Fix:** `signContract()` needs to set `locked_at = now()` on the transition to `fully_signed`, and the API route needs to extract the requester's IP (`x-forwarded-for`) and device string (`user-agent`) and persist them alongside the signature timestamp.

**Severity: Critical** for the locked_at/retain_until gap (a legal/compliance requirement that silently never happens). The missing IP/device trail is Medium-High on its own.

### 1.7 GDPR data export is permanently broken for every user

**Confirmed live, fully root-caused.**

Requesting an export (`POST /api/account/data-export`) succeeds and creates a `pending` request. Running the actual fulfilment cron job (`POST /api/cron/data-export`) responds 200 but reports `{"processed":0,"failed":1}`, and the request's own row flips to `status: "failed"` with no error detail recorded anywhere (the code's own catch block, `lib/supabase/data-export.ts:149`, does `catch { failed++ }`, discarding the actual error rather than logging or storing it, a separate small observability gap on its own).

Root-caused directly by testing the exact same storage call the code makes: `processExportRequest()` (`lib/supabase/data-export.ts:89-94`) uploads the assembled export as `contentType: 'application/json'` to the `docs` storage bucket. Tested that upload directly against Supabase Storage and got back `{"statusCode":"415","error":"invalid_mime_type","message":"mime type application/json is not supported"}`. The `docs` bucket's configured allowed MIME types are images and `application/pdf` only, since it was originally provisioned for "media packs / sponsorship brief PDFs" (per its own code comment in `lib/storage/index.ts`), never JSON.

**Net effect: every single "Download my data" request, from any user, fails every time, permanently, with the user only ever seeing a stuck "pending" or "failed" status and no explanation.** This is not an edge case; it cannot ever succeed as built.

**Fix:** upload the export as a zip or a format the `docs` bucket already accepts, or add `application/json` to that bucket's allowed MIME types, or provision a dedicated bucket for exports. Separately, fix the swallowed-error catch block so future failures of any kind are actually visible.

**Severity: Critical.** This is a GDPR statutory right (access/portability) the spec explicitly commits to fulfilling within 72 hours, and it cannot ever succeed.

### 1.8 Brand-to-athlete and brand-to-team connection requests: the route exists, the actual feature was never finished

**Confirmed via code.**

`/brand/discover/[userId]` and `/brand/discover/team/[userId]` both load without 404ing now (a prior fix addressed the routing), but neither page has a working "send connection request" action. Both render a shared detail component (`AthleteProfileDetail` / `TeamProfileDetail`) whose only interactive element is a "Back" link. **A brand still cannot initiate contact with a single athlete or team through the UI**, which is the platform's entire paid value proposition.

**Fix:** add the same connect-dialog pattern already working elsewhere (`components/discovery/listing-card.tsx` has a complete, working example: message textarea, 300-character limit, `POST /api/discovery/connections` call) to both detail components.

**Severity: Critical.**

---

## 2. Confirmed Working (verified, not assumed)

Listed so the launch-readiness picture is not all bad news, and so nothing here gets re-investigated unnecessarily:

- **Athlete onboarding, all six steps plus publish:** tested end to end live. Profile correctly transitions from `draft` to `active`. Dashboard loads clean afterward. This is the one role whose implementation is solid throughout.
- **Team-to-brand and athlete-to-brand connection requests, acceptance, and match creation:** tested live in both directions. The match-creation database trigger fires correctly even on direct writes, a robust design.
- **Duplicate connection request prevention:** tested by sending the same request seven times; the first succeeds, every subsequent attempt is correctly rejected with 409.
- **Agent-to-athlete representation requests:** tested live end to end, request and acceptance both work correctly.
- **The full deal negotiation and contract pipeline itself** (proposal send, accept, contract auto-creation with a correct terms snapshot, sequential brand and athlete/team signing): tested live end to end and works, aside from the locked_at/audit-trail gap in 1.6.
- **Job listing creation and publishing:** works correctly. This closes out the original "can brands post jobs" question from earlier in this engagement: yes, once a brand has a working profile, which was the actual blocker, not job posting itself.
- **User-level two-factor authentication, enrollment through enforcement:** tested completely live, including generating a real, valid TOTP code independently (standard RFC 6238 algorithm) and confirming both that activation works and that a genuinely 2FA-enabled account gets correctly redirected to the challenge page on login. See section 5 for why an earlier test suggested this was broken; it is not.
- **Admin 2FA:** identical mechanism, tested the same way with a real admin test account, works correctly.
- **All twelve admin pages** (dashboard, analytics, athletes, brands, listings, users, verification, reports, payments, subscriptions, audit, config): every one returns a clean response with no crashes.
- **An admin approving a verification request:** the request/review mechanism itself works (see 3.1 for what it fails to do afterward).
- **Five of six background cron jobs** (GDPR deletion, rate-limit maintenance, chat cleanup, guardian-consent expiry, the 18th-birthday adult-transfer job): all run cleanly once properly authenticated. The sixth (subscription reconciliation) fails only because Stripe product price IDs are not yet configured, a business-side task, not a code bug.
- **Push subscription storage:** works.
- **Social OAuth's fail-closed behaviour:** correctly redirects to an "unavailable" state with no crash when a provider has no credentials configured, exactly as designed.
- **Stripe Connect's fail-closed behaviour:** returns a clear, well-formed error identifying exactly which environment variables are missing, rather than crashing opaquely.

Note on the above: several of these ("connection accepted," "proposal received," etc.) succeed at their core database/API function correctly even though, per 1.5, the notification email that is supposed to accompany them never actually sends. Those are two separate layers and both were checked independently.

---

## 3. Additional Medium-Severity Findings

### 3.1 Verification badge approval does nothing

**Confirmed live.** The request-and-review workflow (athlete requests a badge, admin approves it) runs mechanically end to end, but `reviewVerification()` (`lib/supabase/verification.ts:105-126`) only ever updates the `verification_requests` table's own status column. It never writes back to the athlete, team, brand, or agent profile. No blue badge appears anywhere, no search-ranking boost occurs, because nothing in the codebase ever propagates an approval back to a profile. From a user's perspective, applying and getting approved produces no visible change whatsoever.

**Severity: Medium-High.** Not launch-blocking (verification is a trust signal, not core transactional functionality), but the entire feature is currently decorative.

### 3.2 Agents can represent athletes, but not teams

**Confirmed via code.** `components/agent/represent-button.tsx` hardcodes `client_role: 'athlete'`. No team equivalent exists anywhere in the codebase. The spec describes agents representing "athletes and teams" throughout; only the athlete half is built.

**Severity: Medium.**

### 3.3 Brand onboarding may let users skip out of the wizard after step 1

**Not yet live-verified, flagged from code.** `brand_profiles.status` defaults to `'pending_approval'`, not `'draft'` (`supabase/migrations/20260419000002_profiles.sql:152`). Middleware's onboarding-complete check is the same shared rule everywhere: `status !== 'draft'`. Since a freshly-created brand row's status is `'pending_approval'` the moment step 1 succeeds, that check passes immediately, `'pending_approval' !== 'draft'` is true, which may let middleware consider a brand's onboarding "complete" and stop redirecting them into the wizard right after step 1, even though steps 2 through 4 (industry, description, target sports, seeking) were never filled in.

This surfaces the same underlying design issue as 1.1 and 1.2, a single shared `status !== 'draft'` check applied uniformly across four roles whose status enums don't all treat `'draft'` as the only "incomplete" value, just with the opposite consequence (finishing too early instead of never finishing at all). Confirming this live requires a brand that gets past the LinkedIn bug in 1.3 first, then deliberately backs out mid-wizard to see whether they can reach the dashboard early; this was not completed this session.

**Severity: Medium** (unverified, but the mechanism is real and shares its root cause with two confirmed criticals).

### 3.4 Minor API inconsistency

The connection-request and proposal-respond endpoints both use `{ action: "accept" | "decline" | ... }`, while the representation-link accept endpoint uses `{ accept: true | false }`, a different shape for conceptually the same kind of action. Not a bug, just worth normalizing for maintainability.

---

## 4. Low-Severity Finding

### 4.1 Page-transition wrapper has no fallback if its animation frame never fires

**Confirmed via code, reproduced under a specific condition.** `components/layout/page-transition.tsx` wraps every route in a div that starts at `opacity-0` and only becomes visible once a `requestAnimationFrame` callback fires to flip an `entered` state flag. Confirmed in this session's own testing environment that when a browser tab is backgrounded (`document.visibilityState === 'hidden'`), the rAF callback does not fire, and fully-rendered, correct page content (verified present in the DOM directly) stays invisible indefinitely. No timeout or fallback exists.

For a normal user with their tab focused, this is unlikely to manifest, since rAF fires reliably in a foregrounded tab. Flagging it because it cost real debugging time to trace during this session and could plausibly affect a real user in specific circumstances (a link opened in a background tab, aggressive mobile browser tab-throttling, a slow device where the first rAF is delayed).

**Severity: Low.**

---

## 5. Retracted and Corrected Findings

Full transparency on what was investigated and walked back, since this matters for trusting the rest of the report.

### 5.1 RETRACTED: "user-level 2FA enforcement is broken"

An initial browser-based test showed a 2FA-enabled account reaching its dashboard with no challenge at all, across a soft navigation, a hard reload, and even a full dev server restart. This looked like a serious, confirmed security bug and was very nearly reported as one.

Re-tested with a direct HTTP request using a cookie jar (`curl -b cookies.txt http://localhost:3000/athlete/dashboard`), completely bypassing the browser: a clean `307 Temporary Redirect` to `/auth/2fa`, exactly as it should be. **The middleware enforcement works correctly.** The browser-based test was a false negative caused by Next.js's client-side router cache serving a stale, pre-2FA page state that a genuine fresh request never would. Fully retracted; 2FA enrollment, activation, and enforcement are all confirmed working.

### 5.2 CORRECTED: the team/agent onboarding bug's visible symptom, not its existence

The underlying bug (1.1 and 1.2 above) is real and confirmed. But the original description, based on browser observation, described "77+ rapid repeated network requests" for team and a fully "frozen, unresponsive renderer" for agent, both of which sounded like a severe client-side infinite loop.

Re-tested both cleanly via curl: in both cases, the dashboard correctly issues a single 307 redirect to onboarding, and the onboarding page itself returns a single clean 200 (the form again), not a redirect chain and not a hang. The real, confirmed consequence is precise and still serious: **the user is permanently stuck being served the onboarding form again with no way to reach their account**, but the specific "rapid loop" and "frozen renderer" symptoms were very likely client-side React behaviour layered on top of the real bug by the degraded browser environment, not the bug itself. The fix target (make `createTeamProfile`/agent's equivalent actually activate the profile) is unchanged.

### 5.3 RETRACTED: "the proposal-accept endpoint hangs indefinitely"

A first attempt to accept a proposal appeared to hang for 45+ seconds with no response, the browser tab's renderer froze, and the database showed no change had happened. This looked like it might be the single most severe bug in the report, since it would mean no deal could ever be completed.

Retested cleanly with a brand-new match and proposal, with no abort mechanism this time: completed successfully in under two seconds. Separately, called the underlying database function directly (bypassing the Next.js route entirely): completed instantly. **Retracted.** The most likely explanation is that the first attempt coincided with Next.js compiling that specific route for the first time in the dev session (seen elsewhere taking 5-10+ seconds on a cold hit) stacked on top of the browser tab already being in a degraded state from the agent-onboarding investigation immediately before it. Not reproducible on a clean retry, and not included as a bug.

---

## 6. What This Pass Did Not Cover

In the interest of an honest scope disclosure rather than implying full coverage: exhaustive per-endpoint rate-limit verification (one instance was confirmed working incidentally via duplicate-prevention), genuine concurrent-user race conditions (this pass could not produce true concurrency, only sequential requests), admin moderation actions beyond verification approval (user suspension, listing takedown, refunds), the listing edit/pause/close lifecycle, shortlist/save flows, blocking and unblocking, chat attachments and file-type handling within messages, and subscription upgrade/downgrade against a real Stripe account. These were not skipped for being low priority; they simply did not fit within even this very large pass, and are the natural next things to test once the critical bugs above are fixed (several of them, like chat attachments, cannot be meaningfully tested until 1.4 is fixed and messaging actually opens up).

---

## 7. Third-Party Accounts Still Needed (carried forward, unchanged)

Unchanged from the previous audit, restated briefly since fixing the bugs above does not remove this need: a Resend account (the email code is fully built and waiting on this, though 1.5 above means it will not actually deliver anything until that bug is also fixed), Stripe product price IDs for the three subscription tiers plus Stripe Connect enabled on the account, a KYC/identity provider if the verification badge feature is pursued further, Companies House API access, developer app credentials from Meta, TikTok, X, YouTube, and LinkedIn for social OAuth, and a decision on whether to integrate a real e-signature provider or keep the in-house signer permanently.

Two additional secrets were generated locally this session with no external account needed, matching the pattern of the earlier ones: `CRON_SECRET` (was entirely unset, meaning every background job was silently unable to run at all until this was added).

---

## 8. Path to Public-Test Ready

This section exists to answer a different question than sections 1 through 4: not "what is broken" but "what specifically has to be true before real outside users touch this." It sorts the eight critical bugs into two groups, since they do not all block a public test for the same reason.

### 8.1 Hard blockers, regardless of which roles are included in the test

These are not role-specific and do not get smaller with a limited-invite test, because they are either legal obligations or they break the product's core loop for everyone:

- **1.4, messaging never unlocks.** If a real brand and a real athlete or team cannot have a normal conversation once matched, the product's central loop does not function for any tester, in any role. Not a "known issue," a blocker.
- **1.6, contracts never lock, no signer IP/device.** The moment a real person signs a real contract during a test, this is a live legal-retention and audit-trail gap, not a hypothetical one. A "beta" label does not change what a signed contract legally requires.
- **1.7, GDPR export permanently broken.** The same logic applies: GDPR rights attach the moment real personal data is collected, test or not. Shipping this broken to any real user is a statutory-compliance risk from day one of the test, not just at general launch.
- **1.5, no transactional email ever sends.** Softer than the three above since the app is still usable without it, but a tester who sends a connection request or a proposal and never gets notified will very reasonably conclude the product is broken or dead. Strongly recommend fixing before external users, not just before general launch.

### 8.2 Role-specific blockers: only matters if that role is in the test's scope

- **1.1 (team) and 1.2 (agent), onboarding never completes.** Either fix both, or explicitly exclude team and agent signups from the test's scope and only invite athletes and brands. There is no safe middle ground: inviting a team or agent tester today means handing them a account that is permanently stuck the moment they finish signing up.
- **1.3, brand LinkedIn crash.** Blocks 100% of brand signups with zero explanation to the user. If brands are in scope for the test at all, this is a hard blocker, not a soft one, since it stops them before they can do anything else.
- **1.8, brand cannot message athletes or teams.** If brands are in scope, this blocks the entire reason a brand would be in the test in the first place.

### 8.3 What this implies for scoping a first public test

Realistically, athlete-only or athlete-plus-brand test scopes are the only ones that do not require fixing every item in 8.2 first, and even then, 8.1's four items still need to be closed first since they are not role-specific. A test that includes team or agent accounts today will produce a permanently broken account for every single one of those testers on day one.

**Recommended minimum bar before inviting any real outside user:** all four items in 8.1, plus whichever items in 8.2 correspond to the roles actually being invited. Everything in sections 3 and 4 (medium and low severity) can reasonably ship into a public test with the bug still open and tracked, since none of them stop a user from completing a core flow.

---

*Prepared as a working document reflecting the state of the code at the time it was tested. Re-verify against current `main` before acting on anything here if meaningful time has passed.*
