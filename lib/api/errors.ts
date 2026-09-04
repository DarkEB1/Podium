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

/** RFC 4122 shape check. PostgREST answers a non-UUID id with SQLSTATE 22P02
 * and the raw driver text; validating here turns that into a clean 400. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** A domain error that carries a stable, non-driver `code`. */
interface CodedError {
  code: string
  message: string
}

function isCodedError(err: unknown): err is CodedError {
  if (!(err instanceof Error)) return false
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' && code.length > 0
}

export interface SafeErrorOptions {
  /** Log prefix, e.g. 'admin/profiles'. */
  scope: string
  /** Per-code HTTP status. Codes absent here fall back to `fallbackStatus`. */
  statusByCode?: Record<string, number>
  /** Codes whose OWN message is written by us and safe to show the user. */
  safeToShow?: Iterable<string>
  fallbackStatus?: number
  fallbackMessage?: string
}

/**
 * Turn a domain error (AdminError, VerificationError, …) into a JSON response
 * whose body never carries raw Postgres/Stripe/GoTrue driver text. Returns null
 * when `err` is not a coded domain error, so the caller re-throws it (Next then
 * answers with its own 500 — the right behaviour for a genuine bug).
 *
 * Codes in `safeToShow` keep their own message (we wrote it). Everything else is
 * logged server-side and replaced with a generic sentence, because an unmapped
 * code means the message is raw driver text naming internal columns and types.
 */
export function safeErrorResponse(
  err: unknown,
  options: SafeErrorOptions
): NextResponse | null {
  if (!isCodedError(err)) return null

  const status = options.statusByCode?.[err.code] ?? options.fallbackStatus ?? 500
  const safe = new Set(options.safeToShow ?? [])

  if (safe.has(err.code)) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status }
    )
  }

  console.error(`[${options.scope}] rejected`, err.code, err.message)
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message:
          options.fallbackMessage ??
          'Something went wrong on our end. Please try again in a moment.',
      },
    },
    { status }
  )
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
