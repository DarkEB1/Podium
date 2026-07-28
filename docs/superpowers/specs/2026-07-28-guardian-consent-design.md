# Guardian Consent Enforcement — Design

Date: 2026-07-28
Status: Approved, ready for planning
Punch-list item: 2.3 (under-18 guardian consent collected but never enforced)

## Problem

`components/athlete/guardian-form.tsx` captures a guardian's details for under-18
athletes, but nothing enforces consent. `lib/supabase/deals.ts` has zero guardian
references, so an under-18 athlete can sign a binding contract and trigger payout
with no guardian involvement. This is a legal liability flagged in
`docs/claude/lessons.md`.

## Decisions

1. **Consent model: hybrid.** A one-time blanket consent gates whether an under-18
   athlete may enter any binding transaction. Each signed deal then sends the
   guardian an informational notice. The per-deal step is notice, not an approval
   gate.
2. **Consent mechanism: secure token link by email.** No guardian account. The
   athlete triggers a request; the guardian receives a signed, expiring link and
   accepts. Uses the already-collected `guardian_email` and the existing
   `lib/email` transport.
3. **Enforcement: DB trigger plus TS guard.** The database trigger is the real,
   unbypassable gate. The TypeScript check exists only to return a clean error
   before the round-trip.

## Data model

Reuse on `athlete_profiles` (all already present in
`20260419000002_profiles.sql`): `date_of_birth`, `is_under_18` (trigger-computed),
`guardian_name`, `guardian_email`, `guardian_accepted_at`.

New table `guardian_consent_tokens`:

| column           | type        | notes                                    |
|------------------|-------------|------------------------------------------|
| id               | uuid pk     | default `gen_random_uuid()`              |
| athlete_user_id  | uuid        | not null, FK to `athlete_profiles.user_id`, on delete cascade |
| token_hash       | text        | not null. SHA-256 of the raw token. Raw token is never stored |
| expires_at       | timestamptz | not null                                 |
| consumed_at      | timestamptz | null until the guardian accepts          |
| created_at       | timestamptz | not null default `now()`                 |

RLS: enabled, with no policy granting `anon`/`authenticated` any access. Only the
service-role server routes read or write this table. The guardian's capability is
possession of the raw token, validated server-side by hash.

## Enforcement

### Hard gate: DB trigger

Function `enforce_guardian_consent_on_sign()`, `BEFORE UPDATE ON contracts`:

- Fire only when `OLD.athlete_signed_at IS NULL AND NEW.athlete_signed_at IS NOT NULL`
  (the athlete is signing on this update).
- Look up `athlete_profiles` where `user_id = NEW.athlete_or_team_id`.
- If a row exists and `is_under_18 = true` and `guardian_accepted_at IS NULL`,
  `RAISE EXCEPTION` with message code `GUARDIAN_CONSENT_REQUIRED`.
- Teams (no `athlete_profiles` row) and adult athletes pass through untouched.

Because it is a trigger, it fires even when `signContract` writes through the
service-role admin client, which bypasses RLS.

### Clean error: TS guard

`signContract` (`lib/supabase/deals.ts`), when the signer is the athlete party,
fetches `is_under_18` and `guardian_accepted_at` first and throws
`DealsError('GUARDIAN_CONSENT_REQUIRED')` before writing. The sign route maps this
code to HTTP 403. `components/deals/contract-sign-button.tsx` renders a blocked
state with an action to send the guardian a consent request, rather than surfacing
a raw error.

## Consent request and acceptance flow

1. `POST /api/guardian-consent/request` (athlete authenticated). Allowed only for
   an under-18 athlete who has a `guardian_email` and no existing
   `guardian_accepted_at`. Generates a random token, stores its SHA-256 hash with a
   7-day expiry, and emails the guardian a link to `/guardian/consent/[token]` via
   `lib/email`. Rate-limited like other state-changing routes.
2. `GET /guardian/consent/[token]` (public server component). Validates the token
   by hash, checks it is unexpired and unconsumed, and shows the athlete's name and
   what the consent covers. Invalid, expired, or consumed tokens render a plain
   explanatory page, not a mutation.
3. `POST /api/guardian-consent/accept` (public, token supplied in the request body,
   reached only after a confirm click so there is no GET-triggered mutation).
   Re-validates the token, sets `athlete_profiles.guardian_accepted_at = now()` via
   the admin client, and marks the token `consumed_at`. Idempotent on an
   already-consumed token for the same athlete.

## Per-deal notice (hybrid half)

On a successful under-18 athlete signature, the sign route sends the guardian an
informational email (brand name, deal title, amount) via `lib/email`. It does not
block anything.

## Scope boundaries (explicit)

- The gate is on the binding act (signing, which unlocks payout), not on profile
  visibility. An under-18 athlete may onboard and appear in discovery before
  consent; they simply cannot sign.
- The expired-token / abandoned-signup purge cron is out of scope here. The tokens
  table is shaped so the future guardian-expiry cron (punch-list item 2.5) can
  purge expired, unconsumed tokens. That cron is a separate item.
- The 18th-birthday control-transfer job (also item 2.5) is unrelated and separate.

## Testing

- Migration test (matching `supabase/migrations/*.test.ts`): under-18 unconsented
  signature raises; consented passes; adult passes; team passes; the trigger does
  not fire on non-signing updates.
- `lib/supabase/guardian.ts` token lifecycle: create, then valid / expired /
  consumed / unknown token outcomes; hashing never stores the raw token.
- `signContract` guard: throws `GUARDIAN_CONSENT_REQUIRED` for an under-18
  unconsented athlete; succeeds once consented; unaffected for adults and teams.
- Both API routes with `lib/email` mocked: request generates a token and sends;
  accept sets `guardian_accepted_at` and consumes the token; invalid token paths.

## New and changed files

- `supabase/migrations/<ts>_guardian_consent_enforcement.sql` and `.test.ts`
- `lib/supabase/guardian.ts` and `lib/supabase/guardian.test.ts`
- `lib/supabase/deals.ts` (guard in `signContract`) and `deals.test.ts` additions
- `app/api/guardian-consent/request/route.ts` and `.test.ts`
- `app/api/guardian-consent/accept/route.ts` and `.test.ts`
- `app/guardian/consent/[token]/page.tsx`
- `lib/email` additions: guardian consent-request template and deal-notice template
- `components/deals/contract-sign-button.tsx` (blocked state)
- `components/athlete/settings-form.tsx` or the guardian section (send-request action)
- `types/database.ts` regenerated after the migration
