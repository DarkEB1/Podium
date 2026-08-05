import { NextRequest, NextResponse } from 'next/server'
import { DiscoveryError } from '@/lib/supabase/discovery'

/**
 * Shared route-handler error plumbing.
 *
 * A route handler that re-throws a domain error makes Next answer with an empty
 * non-JSON 500. The browser then throws a SyntaxError inside `res.json()`
 * BEFORE it can read the failure, so the user sees a generic toast or nothing
 * at all. That is how a listing rejected by Postgres reached the brand as a
 * silent no-op.
 *
 * This lives in lib rather than in a route module because App Router route
 * files may only export route fields (GET/POST/PATCH, `runtime`, and friends);
 * exporting a helper from one is a build error.
 */

/** A malformed body must be a 400 with a JSON envelope, never a thrown HTML 500. */
export async function readJsonBody(
  request: NextRequest
): Promise<{ body: Record<string, unknown> } | { response: NextResponse }> {
  try {
    return { body: (await request.json()) as Record<string, unknown> }
  } catch {
    return {
      response: NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
        { status: 400 }
      ),
    }
  }
}

/** Listing codes that carry their own status. Everything else is a rejected write, so 400. */
const LISTING_ERROR_STATUS: Record<string, number> = {
  LISTING_NOT_FOUND: 404,
  LISTING_CLOSED: 409,
}

/**
 * Codes whose message we write ourselves and can show the user. Anything else
 * carries raw Postgres text (`invalid input syntax for type timestamp with time
 * zone: ""`), which names internal columns and types and must stay server-side.
 */
const LISTING_SAFE_TO_SHOW = new Set(['LISTING_NOT_FOUND', 'LISTING_CLOSED'])

/**
 * Turn a DiscoveryError into a JSON response, or null if `err` is something
 * else and the caller should re-throw.
 */
export function listingErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof DiscoveryError)) return null

  const status = LISTING_ERROR_STATUS[err.code] ?? 400
  if (LISTING_SAFE_TO_SHOW.has(err.code)) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
  }

  console.error('[discovery/listings] rejected', err.code, err.message)
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: 'We could not save this listing. Please check your entries and try again.',
      },
    },
    { status }
  )
}
