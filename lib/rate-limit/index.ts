import { createAdminClient } from '@/lib/supabase/server'

/**
 * DH-2 / SEC-2 — rate limiting for auth and state-changing endpoints.
 *
 * Backed by Postgres (`public.check_rate_limit`) rather than process memory,
 * because this app runs on serverless functions where each instance keeps its
 * own heap. An in-memory counter would only throttle an attacker unlucky
 * enough to hit the same instance twice, which is no throttle at all. See
 * supabase/migrations/20260720004000_auth_rate_limits.sql.
 *
 * Limits are applied on TWO axes for credential endpoints:
 *   - by IP, to stop one host spraying many accounts;
 *   - by email, to stop a distributed attack concentrating on one account.
 * Either tripping is a refusal.
 */

export interface RateLimitRule {
  /** Max attempts permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  attempts: number
  /** Seconds until the current window resets — send as Retry-After. */
  retryAfter: number
}

/**
 * Tuned so a human who mistypes a password several times is never blocked,
 * while sustained automated guessing becomes impractical.
 */
export const RATE_LIMITS = {
  /** Sign-in. Deliberately tight per-email: brute force targets one account. */
  loginByIp: { limit: 20, windowSeconds: 300 },
  loginByEmail: { limit: 8, windowSeconds: 300 },
  /** Account creation — abused to spam the verification mailer. */
  signupByIp: { limit: 5, windowSeconds: 3600 },
  /** Password reset — abused to mail-bomb a victim's inbox. */
  passwordResetByIp: { limit: 5, windowSeconds: 3600 },
  passwordResetByEmail: { limit: 3, windowSeconds: 3600 },
  /** Generic state-changing write (connection requests, reports, proposals). */
  writeByUser: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Best-effort client IP. Vercel sets `x-forwarded-for`; the leftmost entry is
 * the original client. These headers are spoofable in general, which is exactly
 * why credential endpoints ALSO limit by email — an attacker who rotates
 * X-Forwarded-For still burns the per-email budget.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Normalise so `A@B.com ` and `a@b.com` share one budget. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function ipKey(action: string, ip: string): string {
  return `${action}:ip:${ip}`
}

export function emailKey(action: string, email: string): string {
  return `${action}:email:${normaliseEmail(email)}`
}

export function userKey(action: string, userId: string): string {
  return `${action}:user:${userId}`
}

/**
 * Consume one attempt against `key`.
 *
 * FAILS OPEN on infrastructure error. This is a deliberate trade-off: if the
 * rate-limit store is unreachable, refusing every login would turn a database
 * blip into a total auth outage. The failure is logged loudly so it cannot pass
 * unnoticed. Endpoints where availability matters less than protection should
 * check `result.degraded` and decide for themselves.
 */
export async function consume(key: string, rule: RateLimitRule): Promise<RateLimitResult & { degraded: boolean }> {
  try {
    const admin = createAdminClient()
    // as never: the RPC is defined in a migration and is not present in the
    // generated types/database.ts until `npm run supabase:types` is re-run.
    const { data, error } = await (admin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>)('check_rate_limit', {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })

    if (error) throw new Error(error.message)

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; attempts: number; retry_after: number }
      | undefined

    if (!row) throw new Error('check_rate_limit returned no row')

    return {
      allowed: row.allowed,
      attempts: row.attempts,
      retryAfter: row.retry_after,
      degraded: false,
    }
  } catch (err) {
    console.error('[rate-limit] store unavailable, failing open for key', key, err)
    return { allowed: true, attempts: 0, retryAfter: 0, degraded: true }
  }
}

/**
 * Consume against several keys at once (e.g. IP and email). Refuses if ANY
 * rule trips, and reports the longest retry-after so the caller is not told to
 * retry while still blocked by a different rule.
 *
 * All keys are consumed even once one has failed, so an attacker cannot avoid
 * burning their per-email budget by first tripping the per-IP one.
 */
export async function consumeAll(
  entries: ReadonlyArray<{ key: string; rule: RateLimitRule }>
): Promise<RateLimitResult & { degraded: boolean }> {
  const results = await Promise.all(entries.map(({ key, rule }) => consume(key, rule)))

  return {
    allowed: results.every((r) => r.allowed),
    attempts: Math.max(0, ...results.map((r) => r.attempts)),
    retryAfter: Math.max(0, ...results.map((r) => r.retryAfter)),
    degraded: results.some((r) => r.degraded),
  }
}

/** Clear a key after a legitimate success so typos don't accumulate. */
export async function reset(key: string): Promise<void> {
  try {
    const admin = createAdminClient()
    // as never: see consume() — RPC not yet in the generated types.
    await (admin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
      'reset_rate_limit',
      { p_key: key }
    )
  } catch (err) {
    // Non-fatal: the window expires on its own.
    console.error('[rate-limit] failed to reset key', key, err)
  }
}

/**
 * The 429 body, in the app's standard error shape, plus a truthful Retry-After.
 * The message deliberately does not reveal which axis tripped or how many
 * attempts remain — that is reconnaissance for an attacker.
 */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a moment and try again.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)),
      },
    }
  )
}
