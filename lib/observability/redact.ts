/**
 * PII redaction for anything that reaches a log sink (DH-6).
 *
 * Podium logs run through Vercel's log drain and, optionally, Sentry. Both are
 * third-party processors, so a log line is a data transfer: an email address, a
 * bearer token or the body of a connection-request message must never appear in
 * one. This module is applied to EVERY payload before it leaves the process —
 * there is deliberately no "raw" escape hatch.
 *
 * The rules are intentionally blunt (deny-list on key name + value shape).
 * Over-redacting a debugging field is recoverable; leaking a user's email is
 * not.
 */

export const REDACTED = '[redacted]'

/**
 * Keys whose VALUE is always dropped, whatever it looks like. Matched
 * case-insensitively as a substring, so `user_email`, `authorizationHeader`
 * and `stripeSecretKey` are all covered.
 */
const SENSITIVE_KEY_PATTERN =
  /(email|token|secret|password|passwd|authorization|cookie|session|api[-_]?key|access[-_]?key|service[-_]?role|dsn|credential|signature|phone|postcode|post_code|address|dob|date_of_birth|message|body|content|note)/i

/** Anything shaped like an email address, wherever it appears in a string. */
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

/** `Bearer abc…`, `sk_live_…`, `whsec_…`, JWTs. */
const TOKEN_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[\w.\-+/=]+/gi,
  /\b(?:sk|rk|pk|whsec|price)_[A-Za-z0-9_]{6,}/g,
  /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g,
]

/** How deep to walk a context object before giving up (cycle/DoS guard). */
const MAX_DEPTH = 6

/** Redacts identifiers embedded in free text (error messages, URLs). */
export function redactString(value: string): string {
  let out = value.replace(EMAIL_PATTERN, REDACTED)
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  return out
}

/**
 * Deep-redacts an arbitrary value. Objects and arrays are rebuilt; unsupported
 * types (functions, symbols) are dropped rather than stringified.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'function' || typeof value === 'symbol') return undefined

  if (depth >= MAX_DEPTH) return '[truncated]'

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1))
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, depth + 1)
    }
    return out
  }

  return undefined
}

/** Convenience wrapper that always yields a plain object. */
export function redactContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!context) return {}
  // redact() on an object literal always returns a Record — the branch above is
  // the only one reachable for a non-null plain object.
  return redact(context) as Record<string, unknown>
}
