/**
 * Single source of truth for policy versions (CL-5).
 *
 * Every surface that references a policy version — the /terms, /privacy and
 * /cookies pages, the sign-up consent checkbox, and the `acceptTerms` write to
 * `users.terms_version` / `users.privacy_version` — MUST import from here.
 *
 * Bumping a constant below is the ONE action required to force re-consent:
 * `isPolicyAcceptanceStale()` compares the stored acceptance against these
 * values, so every user whose stored version no longer matches is treated as
 * not having consented to the current policy.
 *
 * Versions are ISO-8601 dates (YYYY-MM-DD) matching the "last updated" date
 * printed at the top of the corresponding page. Do not use semver — a dated
 * version is what a regulator or a data subject will ask you to produce.
 */

/** Version of the Terms of Service published at /terms. */
export const TERMS_VERSION = '2026-07-20'

/** Version of the Privacy Policy published at /privacy. */
export const PRIVACY_VERSION = '2026-07-20'

/** Version of the Cookie Policy published at /cookies. */
export const COOKIE_POLICY_VERSION = '2026-07-20'

/**
 * Human-readable effective date rendered on each policy page. Kept alongside
 * the versions so the printed date can never drift from the stored version.
 */
export const POLICY_EFFECTIVE_DATE = '20 July 2026'

/**
 * These documents are engineering drafts. Until a qualified solicitor has
 * reviewed and signed them off, this flag stays `true` and every policy page
 * renders a prominent unreviewed-draft notice.
 */
export const POLICIES_ARE_UNREVIEWED_DRAFTS = true

/** Identity of the controller, reused across the policy pages. */
export const CONTROLLER = {
  name: 'Podium',
  legalEntity: 'Podium (legal entity name to be confirmed before launch)',
  country: 'United Kingdom',
  governingLaw: 'England and Wales',
  privacyEmail: 'privacy@podium.com',
  legalEmail: 'legal@podium.com',
  supportEmail: 'hello@podium.com',
} as const

/**
 * The subset of `public.users` columns that record policy acceptance.
 * Column names verified against supabase/migrations/20260419000001_users_auth.sql.
 */
export interface PolicyAcceptance {
  terms_version: string | null
  terms_accepted_at: string | null
  privacy_version: string | null
  privacy_accepted_at: string | null
}

export interface PolicyStaleness {
  /** Stored terms_version is missing or does not match TERMS_VERSION. */
  termsStale: boolean
  /** Stored privacy_version is missing or does not match PRIVACY_VERSION. */
  privacyStale: boolean
  /** True when either policy needs re-acceptance. */
  stale: boolean
}

/**
 * Returns which policies a user must re-accept.
 *
 * A user is stale when the version string is absent, the acceptance timestamp
 * is absent (a version without a timestamp is not evidence of consent), or the
 * stored version differs from the current constant.
 */
export function isPolicyAcceptanceStale(
  user: Partial<PolicyAcceptance> | null | undefined
): PolicyStaleness {
  const termsStale =
    !user?.terms_version ||
    !user?.terms_accepted_at ||
    user.terms_version !== TERMS_VERSION

  const privacyStale =
    !user?.privacy_version ||
    !user?.privacy_accepted_at ||
    user.privacy_version !== PRIVACY_VERSION

  return { termsStale, privacyStale, stale: termsStale || privacyStale }
}

/** Convenience predicate for guards and redirects. */
export function needsPolicyReacceptance(
  user: Partial<PolicyAcceptance> | null | undefined
): boolean {
  return isPolicyAcceptanceStale(user).stale
}
