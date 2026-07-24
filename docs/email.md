# Transactional email (`lib/email`)

This is the email layer the original remediation spec assumed existed (it lists
Resend in the platform line) but which was absent from the codebase. It closes
findings **B-8/SEC-1** (email XSS — now live and defended), **B-9** (contract
fully-signed email — template ready, see the wiring note), **FA-10** (retry /
delivery reliability), and **CL-4** (unsubscribe / preferences link).

## Decisions made (and why)

These were guessed rather than specified. Each is reversible.

| Decision | Choice | Why |
|---|---|---|
| Provider | **Resend, called via `fetch`** | Zero new dependencies. Resend's send API is one authenticated POST. Matches the provider-optional-via-fetch pattern already used by `lib/observability`, `lib/analytics`, `lib/rate-limit`. |
| Preference store | **`profile_settings.notification_matrix`** (cross-role) | Resolves the divergence flagged in the audit: `athlete_profiles.notification_prefs` and `profile_settings.notification_matrix` were two stores for the same thing. The email layer uses the cross-role one; the athlete-scoped column is now **deprecated for delivery**. |
| Unconfigured behaviour | **No-op that records `skipped`** | `RESEND_API_KEY` unset ⇒ nothing is delivered, every attempt is logged, the app runs, and local dev / CI need no mail account. |
| Transactional vs marketing | Catalogue `category` per event | Transactional (deal / money / request) events default **on**, send immediately, and carry a preferences link but **no** one-click unsubscribe (you cannot unsubscribe from a receipt you may need for tax — legitimate service messages under PECR soft opt-in). Marketing events default **off**, require `marketing_opt_in`, and carry a one-click unsubscribe. |
| Quiet hours / digest | **Not applied to transactional email** | Email is not a push; deal and money emails are time-sensitive. The digest remains a documented seam, not a half-built cron. |
| Idempotency | **Caller-supplied key + unique index** | A Stripe webhook retry must not email twice. `payment_received:<intentId>` etc. |

## How to send

```ts
import { createAdminClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/email'

await sendTransactionalEmail(createAdminClient(), {
  event: 'proposal_accepted',
  userId: recipientUserId,
  data: { recipientName, proposalTitle, url },
  idempotencyKey: `proposal_accepted:${proposalId}`, // optional but recommended
})
```

`sendTransactionalEmail` **never throws** — email is a side effect and must not
roll back the action that triggered it. It returns a typed result
(`sent` / `skipped` / `failed` / `error`) for callers that want to assert.

The event catalogue and the exact `data` shape per event live in
`lib/email/types.ts`. Add a new email by adding a catalogue entry, a
`TemplateData` shape, and a template in `lib/email/templates.ts` — the types
force all three to stay in sync.

## Security (B-8 / SEC-1)

Every user-supplied value (display names, proposal titles, the free-text
connection message) is rendered **only** through the `html` tagged template in
`lib/email/escape.ts`, which escapes by default. The single trusted insertion is
a template's own already-escaped output via `raw()`, which is grep-able in
review. `safeUrl()` rejects `javascript:`/`data:` links. There is no path from
user input to unescaped markup; `lib/email/escape.test.ts` and
`lib/email/templates.test.ts` assert this with the exact `"><img onerror=…>`
vector the finding named.

## Reliability (FA-10)

Sends retry up to 3 times with exponential backoff; only 429/5xx/network errors
retry (a 4xx will fail again). Every attempt is recorded in `email_deliveries`
(status, provider id, attempt count, error). Hard bounces, spam complaints and
unsubscribes go on `email_suppressions` and are checked before every send.

## Unsubscribe (CL-4)

Every email footer carries a **Manage email preferences** link to
`/settings/notifications` (a cross-role page). Marketing emails additionally
carry a one-click unsubscribe: an HMAC-signed token (`lib/email/unsubscribe.ts`,
keyed on `UNSUBSCRIBE_SECRET`) in a public `/api/unsubscribe` route that also
emits the RFC 8058 `List-Unsubscribe-Post` header for native Gmail/Apple
one-click. The token is not time-limited — an unsubscribe link in a six-month-old
email must still work (a PECR expectation).

## Configuration

See `.env.local.example`. All email env vars are **validated-when-present, not
required** (same rationale as `CRON_SECRET`): the email subsystem must never
take the payments or auth surfaces down at boot.

- `RESEND_API_KEY` — unset ⇒ no delivery, everything logged as `skipped`.
- `EMAIL_FROM` — verified sender, e.g. `Podium <notifications@mail.podium.app>`.
- `EMAIL_REPLY_TO` — optional.
- `UNSUBSCRIBE_SECRET` — unset ⇒ marketing emails ship a preferences link
  instead of one-click unsubscribe, and the unsubscribe route rejects every
  token (fails closed).

## Not built (deliberately)

- **Provider delivery/bounce webhooks.** `email_suppressions` is populated by
  the unsubscribe route today. Wiring a Resend webhook to record hard bounces
  and complaints into it is a follow-up — the table and `addSuppression()` are
  ready.
- **The digest cron.** `email_digest` is respected as a preference but no job
  batches and sends a digest yet.
- **Auth emails** (verify / reset) remain handled by Supabase Auth itself; this
  layer does not duplicate them.
