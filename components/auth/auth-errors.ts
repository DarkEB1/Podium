/**
 * B-3 / NX-1 — human-readable copy for auth-callback failures.
 *
 * The callback route redirects to the sign-in page with `?error=<code>`; the
 * sign-in page renders the matching sentence. Raw codes (and raw Supabase
 * error strings) are never shown to the user.
 */

export const AUTH_ERROR_CODES = {
  missingCode: 'auth_missing_code',
  expiredLink: 'auth_link_expired',
  invalidLink: 'auth_link_invalid',
  alreadyUsed: 'auth_link_already_used',
  failed: 'auth_callback_failed',
} as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

const MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODES.missingCode]:
    'That confirmation link was incomplete. Request a new one and try again.',
  [AUTH_ERROR_CODES.expiredLink]:
    'That link has expired. Sign in to get a fresh confirmation email.',
  [AUTH_ERROR_CODES.invalidLink]:
    'That link is not valid. It may have been copied incorrectly — request a new one and try again.',
  [AUTH_ERROR_CODES.alreadyUsed]:
    'That link has already been used. You can sign in with your email and password below.',
  [AUTH_ERROR_CODES.failed]:
    'We could not finish signing you in. Please try again, or request a new link.',
}

/**
 * Map an `?error=` code to display copy. Unknown codes (including anything a
 * third party appends to the URL) fall back to the generic sentence, so a raw
 * code can never reach the screen.
 */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return MESSAGES[code] ?? MESSAGES[AUTH_ERROR_CODES.failed]!
}

/**
 * Classify a failure into one of our codes. Accepts either Supabase's own
 * `error_code` / `error_description` query params (which Supabase appends to
 * the redirect URL when an email confirmation fails before our handler runs)
 * or the message from a failed `exchangeCodeForSession`.
 */
export function classifyAuthError(
  errorCode?: string | null,
  description?: string | null,
): AuthErrorCode {
  const haystack = `${errorCode ?? ''} ${description ?? ''}`.toLowerCase()
  if (haystack.includes('expired')) return AUTH_ERROR_CODES.expiredLink
  if (haystack.includes('already') || haystack.includes('used')) {
    return AUTH_ERROR_CODES.alreadyUsed
  }
  if (haystack.includes('invalid') || haystack.includes('not found')) {
    return AUTH_ERROR_CODES.invalidLink
  }
  return AUTH_ERROR_CODES.failed
}
