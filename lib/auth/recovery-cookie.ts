import type { NextResponse } from 'next/server'

/**
 * WS-ACCT-04 — the "this session came from a password-reset link" marker.
 *
 * ## Why it exists
 *
 * A recovery link is exchanged for a *full* Supabase session in
 * `app/api/auth/callback/route.ts` and the user is redirected to
 * `/update-password`. Nothing forced them to actually finish: they could type
 * `/athlete/dashboard` and roam the app on a session obtained purely by
 * receiving an email, and after "updating" the form claimed "Please sign in"
 * while the tab stayed authenticated.
 *
 * The callback sets this cookie on the recovery redirect; `middleware.ts`
 * confines any request carrying it to the update-password screen (plus the
 * endpoints needed to complete or abandon the flow); `password-update` clears it
 * and signs the recovery session out once the new password is set. The reset
 * link therefore stops being a roaming login.
 *
 * ## SECURITY
 *
 * `httpOnly` keeps it off `document.cookie`; `sameSite=lax` suits a first-party
 * navigation cookie; `secure` in production only, so it still works over http on
 * localhost (matching the ONBOARDED / social-connect convention). The value
 * authorises nothing on its own — it only *restricts* where the already-issued
 * session may go — so it is intentionally unsigned. Its short life bounds the
 * window in which an un-completed recovery session is usable at all.
 */
export const RECOVERY_COOKIE = 'podium-recovery'

/** The only value treated as "in recovery". */
const RECOVERY_VALUE = '1'

/**
 * One hour — the same order as a GoTrue recovery link's own validity, so the
 * confinement never outlives the reason for it.
 */
const ONE_HOUR_SECONDS = 60 * 60

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

/** True when the request carries an active recovery marker. */
export function isRecoveryCookieSet(value: string | undefined): boolean {
  return value === RECOVERY_VALUE
}

/** Marks the response as a recovery session (call on the recovery redirect). */
export function setRecoveryCookie(response: NextResponse): void {
  response.cookies.set(RECOVERY_COOKIE, RECOVERY_VALUE, {
    ...BASE_OPTIONS,
    maxAge: ONE_HOUR_SECONDS,
  })
}

/** Drops the recovery marker (call once the password is set, or on sign-out). */
export function clearRecoveryCookie(response: NextResponse): void {
  response.cookies.set(RECOVERY_COOKIE, '', { ...BASE_OPTIONS, maxAge: 0 })
}
