/**
 * WS-SEC-05 — a shared client fetch wrapper that fails loudly on auth loss.
 *
 * The root cause is fixed in middleware (a non-public `/api/*` request from an
 * expired session now returns a JSON 401 instead of a 307 to the sign-in HTML).
 * This wrapper is the client-side backstop for the same class of bug: a browser
 * `fetch` follows redirects transparently, so any redirect to an HTML auth page
 * still arrives as an opaque 200. `apiFetch` treats BOTH a followed redirect and
 * a 401 as an authentication failure and throws `ApiAuthError`, so a caller can
 * never mistake "your session ended" for "it worked". Everything else is handed
 * back as a normal `Response` for the caller to inspect (`res.ok`, `res.json()`).
 */

export class ApiAuthError extends Error {
  readonly code = 'AUTH_REQUIRED'
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

/** True when a Response indicates the caller is no longer authenticated. */
export function isAuthFailure(res: Response): boolean {
  // `res.redirected` is set when fetch transparently followed a redirect — for
  // an app API call that means it was bounced to the sign-in page. 401 is the
  // explicit signal the middleware and route handlers now return.
  return res.redirected || res.status === 401
}

/**
 * `fetch` for same-origin app API calls. Throws {@link ApiAuthError} when the
 * response shows the session is gone; otherwise returns the raw Response.
 */
export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (isAuthFailure(res)) {
    throw new ApiAuthError()
  }
  return res
}
