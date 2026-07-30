# Podium Bug Deep Dive

Prepared after live-testing the team and brand signup flows end to end (real signups, real form submissions, real file uploads, checked actual server logs and network traffic) plus systematic code review of the equivalent athlete and agent flows and every cross-role connection path. Each finding below states plainly whether it was reproduced live or found through code review, so the confidence level is clear.

Written for a technical audience. File and line references are given wherever the fix location is unambiguous.

---

## 1. Team profile creation succeeds, then the user is stuck forever (confirmed live)

**What happens:** a team fills out the onboarding form completely, including logo and cover image, and submits. The server responds 200 and the "Team profile created" success toast appears. The page then never leaves `/team/onboarding`, it silently loops, refetching the same route roughly every 250-400ms, indefinitely. Reproduced twice, confirmed via the dev server access log showing 77+ consecutive `GET /team/onboarding 200` requests after the successful `POST`.

**Root cause:** `team_profiles.status` is defined `not null default 'draft'` (`supabase/migrations/20260419000012_team_agent_buildout.sql`). `createTeamProfile` (`lib/supabase/teams.ts:49-67`) inserts the row without ever setting `status`, so every new team profile is created and stays in `'draft'` forever. Middleware's onboarding gate (`middleware.ts`) reads exactly one thing to decide whether onboarding is finished: `const onboardingComplete = status !== null && status !== 'draft'`. Since status never leaves `'draft'`, every navigation attempt away from onboarding gets bounced back by middleware, which is what produces the loop.

By contrast, athlete onboarding calls a dedicated publish step (`app/api/profiles/me/publish/route.ts`, backed by `publishProfile()` in `lib/supabase/profiles.ts:128`, which does `.update({ status: 'active' })`) as its final action. Team onboarding has no equivalent call anywhere.

**Fix:** either have `createTeamProfile` insert with `status: 'active'` directly, or call the existing publish flow immediately after creation succeeds, inside the server action in `app/(team)/team/onboarding/page.tsx`.

**Severity: Critical.** A team cannot complete signup at all right now, they get a success message and then a permanently broken page.

---

## 2. Agent onboarding almost certainly has the identical bug (found via code, not yet live-verified)

`agent_profiles.status` is defined identically: `not null default 'draft'` (`supabase/migrations/20260419000002_profiles.sql:212`). `lib/nav/config.ts` configures the onboarding-completion check for agents exactly the same way it does for teams: `ONBOARDING_PROGRESS_COLUMNS.agent = 'status'`, and the code comment describing agent onboarding states plainly that nothing beyond row existence is checked by the page itself: *"Agent onboarding is likewise one form, and stricter still: the page redirects to the agent profile the moment an `agent_profiles` row exists."* Grepping the entire codebase for any call to the publish endpoint from agent onboarding turns up nothing.

Since middleware's gate is the same shared function regardless of role, and agent's status never leaves `'draft'` for the same structural reason as team, this should reproduce the exact same infinite loop. I did not run this one live this session (time), but recommend treating it as effectively confirmed given the code is structurally identical to the team case, and verifying with one real agent signup before considering it fixed.

**Severity: Critical, same class as #1.**

---

## 3. Brand profile creation crashes if LinkedIn is left blank, with zero feedback to the user (confirmed live)

**What happens:** brand onboarding step 1 (Company Basics) labels the LinkedIn field "(optional)". Leaving it blank and clicking Next does nothing visible, the button briefly shows "Saving…" then reverts to "Next →" with no error message of any kind. The user has no way to know why they can't proceed.

**Root cause, three layers deep, all confirmed from the actual server log for this exact repro:**

1. **Database:** `brand_profiles.linkedin_url` is `text not null` with no default (`supabase/migrations/20260419000002_profiles.sql:160`), the only column across all four profile tables with this exact "required, no default" shape (checked athlete, team, and agent profiles specifically; none of them have this problem).
2. **Frontend contradicts the database:** `components/brand/brand-profile-form.tsx:49` defines the field as `z.string().url(...).optional().or(z.literal(''))`, explicitly optional, explicitly allows empty. The form has no idea the database will reject it.
3. **API makes it worse:** `app/api/profiles/me/route.ts:92` catches `PROFILE_ALREADY_EXISTS` specifically but then does a bare `throw err` for every other error, including this one. Next.js turns that into a 500 with no JSON body. The client's own `onSubmit` handler (`components/brand/brand-profile-form.tsx:260-261`) calls `res.json()` unconditionally without checking `res.ok` first, so it then throws a second, unrelated `SyntaxError: Unexpected end of JSON input` trying to parse the empty body, which is what actually gets caught and silently swallowed, leaving the user with nothing.

Confirmed via the exact server-side stack trace produced by this repro:
```
Error [ProfileError]: null value in column "linkedin_url" of relation "brand_profiles" violates not-null constraint
    at createProfile (lib\supabase\profiles.ts:77:11)
    at async POST (app\api\profiles\me\route.ts:77:21)
```

**Fix, all three layers should be addressed:**
- Either drop the `not null` constraint on `linkedin_url` (matching the form's own stated intent that it's optional), or make the form actually require it if the business rule is that brands must supply LinkedIn.
- `app/api/profiles/me/route.ts`'s catch block should handle `ProfileError` generically and return a real `NextResponse.json({ error: {...} }, { status: 400 })` instead of falling through to `throw err`.
- `brand-profile-form.tsx`'s `onSubmit` should check `res.ok` before calling `.json()`, and show the user a real error toast either way.

**Severity: Critical.** No brand can create a profile without LinkedIn today, and gets no explanation why.

---

## 4. Brand onboarding may let users skip out of the wizard after step 1 (found via code, not yet live-verified)

This is the mirror image of #1 and #2. `brand_profiles.status` defaults to `'pending_approval'`, not `'draft'` (`supabase/migrations/20260419000002_profiles.sql:152`). Middleware's onboarding-complete check is the same everywhere: `status !== 'draft'`. Since a freshly-created brand row's status is `'pending_approval'` on creation (the moment step 1 succeeds), that check passes immediately, `'pending_approval' !== 'draft'` is true, which may let middleware consider a brand's onboarding "complete" and stop redirecting them into the wizard the moment step 1 finishes, even though steps 2 through 4 (industry, description, target sports, seeking) were never filled in.

I have not confirmed this live (it requires a brand that gets past the LinkedIn bug above first, then deliberately backing out mid-wizard to see whether middleware lets them through to the dashboard early). Flagging it because the underlying mechanism, a single shared `status !== 'draft'` check applied uniformly across four roles whose status enums don't all treat `'draft'` as the only "incomplete" value, is exactly the kind of thing that produces bugs 1, 2, and this one from the same root design choice. Worth a dedicated look regardless of whether this specific consequence reproduces.

**Severity: Medium** (unverified, but the mechanism is real and shared with two confirmed criticals).

---

## 5. Brand → Athlete: the connection route no longer 404s, but there is still no way to actually send a request (confirmed via code)

The previous audit's top finding was that `/brand/discover/[userId]` didn't exist. It exists now. But the page (`app/(brand)/brand/discover/[userId]/page.tsx`) renders only `<AthleteProfileDetail>`, and that component (`components/discovery/athlete-profile-detail.tsx`) imports nothing related to connections, dialogs, or the discovery API, its only interactive element is a "Back" link (line 74). The component's own copy talks about whether the athlete is "open to connection requests," but there is no button, form, or dialog that actually sends one.

**A brand still cannot contact a single athlete through the UI.** The routing got fixed; the actual feature this route exists to provide was not.

**Fix:** add the same connect dialog pattern already working elsewhere (`components/discovery/listing-card.tsx` has a complete, working example: a message textarea, a 300-character limit, and a `POST /api/discovery/connections` call) to `AthleteProfileDetail`.

**Severity: Critical.** This is the same "core loop" gap from the original audit, just one layer deeper than before.

---

## 6. Brand → Team: identical gap (confirmed via code)

`app/(brand)/brand/discover/team/[userId]/page.tsx` renders `<TeamProfileDetail>` (`components/discovery/team-profile-detail.tsx`), which has the exact same shape as the athlete version: only a "Back" link, no connect action anywhere. Same root cause, same fix pattern, same severity as #5.

---

## 7. Agents can represent athletes, but not teams (confirmed via code)

`components/agent/represent-button.tsx`, the button that actually sends an agent's representation request, hardcodes `client_role: 'athlete'` in its request body (line 32). Grepping the whole codebase for any team equivalent (a team-flavoured represent button, or any call passing `client_role: 'team'`) finds nothing. The spec describes agents representing "athletes and teams" throughout; as built, only the athlete half exists.

**Severity: Medium.** Not launch-blocking on its own, but a real gap against the stated agent value proposition.

---

## 8. Page-transition wrapper has no fallback if its animation frame never fires (confirmed via code, edge-case severity)

While investigating the brand listing form appearing completely blank, I traced it to `components/layout/page-transition.tsx`. Every route is wrapped in a div that starts at `opacity-0` and only becomes visible once a `requestAnimationFrame` callback fires (`useEffect` at lines 71-77) to flip an `entered` state flag. I confirmed in my own reproduction that when a tab is backgrounded (`document.visibilityState === 'hidden'`, `document.hasFocus() === false`), the rAF callback does not fire, and the fully-rendered, correct page content (verified present in the DOM via direct inspection) stays invisible indefinitely, there is no timeout or fallback.

For a normal user with their tab focused, this likely never manifests, since rAF fires reliably in a foregrounded tab. It's a real robustness gap worth a small fix (a `setTimeout` fallback, or simply not gating first-paint visibility on animation state) but I would not treat it as launch-blocking on its own, flagging it because it cost real debugging time to trace and could plausibly bite a real user in specific circumstances (a link opened in a background tab, aggressive mobile browser tab-throttling, a slow device where the first rAF is delayed past some other timeout).

**Severity: Low.**

---

## What this deep dive did and did not cover

**Live-tested end to end this session:** team signup and onboarding (bug #1 found), brand signup and onboarding (bug #3 found), login, role selection, both with real accounts against the live Supabase project.

**Confirmed via direct code review, not live reproduction:** bugs #2, #4, #5, #6, #7, #8, plus a full audit of all four profile tables' NOT NULL-without-default columns (only brand's `linkedin_url` has this shape; the pattern is not systemic).

**Not covered this session, recommend a dedicated pass:** athlete onboarding and discovery (the most mature, least-changed area, and the full 2196-test suite passes, so lower risk but not zero), messaging between matched parties, the deals/contract/e-signature pipeline, the admin panel's newer surfaces (2FA enrollment, verification review queue, analytics, audit log, config), Stripe Connect onboarding, the social OAuth connect flow, GDPR data export, and the guardian-consent flow's actual email/accept mechanics. None of these showed anything suspicious in passing, but none were deliberately exercised either.

---

*Prepared as a working document. Re-verify against current `main` before acting on it if meaningful time has passed.*
