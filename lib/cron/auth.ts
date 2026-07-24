import { timingSafeEqual } from 'crypto'

/**
 * Shared authentication for Vercel Cron entry points.
 *
 * Extracted so every scheduled job enforces the same rule rather than each
 * route re-implementing it — a second, subtly weaker copy is how an unauthed
 * cron endpoint ends up in production.
 *
 * Contract: `Authorization: Bearer <CRON_SECRET>`, compared in constant time.
 * Anything else — missing header, wrong scheme, wrong secret, or an unset
 * CRON_SECRET — is unauthorised. It FAILS CLOSED: an unset secret means nobody
 * is authorised, never everybody.
 *
 * Note that these routes must also be listed in middleware.ts PUBLIC_PATHS,
 * because Vercel Cron calls them without a user session; the middleware would
 * otherwise redirect them to the sign-in page and the job would never run.
 */
export function isAuthorizedCronRequest(request: { headers: Headers }): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return false

  const provided = header.slice('Bearer '.length)

  try {
    const a = Buffer.from(provided)
    const b = Buffer.from(secret)
    // timingSafeEqual throws on length mismatch, so the length check must come
    // first. Length is not itself a useful oracle for a fixed-length secret.
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** The standard 401 for an unauthenticated cron call. */
export function cronUnauthorized(): Response {
  return new Response(
    JSON.stringify({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron credentials' },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
