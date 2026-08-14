import type { NextResponse } from 'next/server'

/**
 * The "this user has finished onboarding" fast-path cookie (perf).
 *
 * ## What it is
 *
 * The PR-9 onboarding gate in `middleware.ts` runs
 * `from(PROFILE_TABLE[role]).select(ONBOARDING_PROGRESS_COLUMNS[role])` on EVERY
 * authenticated navigation, purely to answer "has this user finished
 * onboarding?". For a user who already finished, that answer never changes, yet
 * the query still crosses the Atlantic (Vercel iad1 -> Supabase eu-west-2) each
 * time. This cookie caches the finished state so the gate can skip the query.
 *
 * It is set when onboarding completes (`/api/profiles/me/publish` for
 * athlete/team/agent, `/api/profiles/me/onboarding-complete` for brand) and,
 * as a self-healing fallback, by the middleware itself whenever its query
 * observes completion. It is cleared on sign-out so it cannot leak across a
 * different user signing in on the same browser.
 *
 * ## SECURITY — read before consuming this cookie
 *
 * This value may ONLY short-circuit the onboarding *UX redirect*. It is never
 * consulted by the admin gate, the admin/user 2FA gates, the inbound-header
 * strip, or any authorisation decision — those all run first and are untouched.
 *
 * It is deliberately unsigned: unlike the admin-2FA cookie it authorises
 * nothing. The worst a forged `podium-onboarded=1` can do is let a not-yet-
 * onboarded user reach an app page — where RLS still guards every row and the
 * page's own `if (!profile) redirect('/onboarding')` still fires. No data is
 * exposed and no gate is weakened, so an HMAC here would buy nothing.
 */
export const ONBOARDED_COOKIE = 'podium-onboarded'

/** The only value the fast-path treats as "onboarded". */
const ONBOARDED_VALUE = '1'

/**
 * A year. Onboarding, once finished, is never un-finished, so a long life is
 * safe; the middleware re-sets the cookie whenever it observes completion, so
 * it self-heals if a browser drops it.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * `secure` only in production so the cookie still works over http on localhost
 * (matches the convention in app/api/social/[provider]/connect). `httpOnly`
 * keeps it off `document.cookie`; `sameSite=lax` is standard for a first-party
 * navigation cookie.
 */
const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

/** True when the request carries a valid onboarded fast-path cookie. */
export function isOnboardedCookieSet(value: string | undefined): boolean {
  return value === ONBOARDED_VALUE
}

/** Marks the response's browser as known-onboarded. */
export function setOnboardedCookie(response: NextResponse): void {
  response.cookies.set(ONBOARDED_COOKIE, ONBOARDED_VALUE, {
    ...BASE_OPTIONS,
    maxAge: ONE_YEAR_SECONDS,
  })
}

/** Drops the fast-path cookie (call on sign-out). */
export function clearOnboardedCookie(response: NextResponse): void {
  response.cookies.set(ONBOARDED_COOKIE, '', { ...BASE_OPTIONS, maxAge: 0 })
}
