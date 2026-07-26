import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  isPolicyAcceptanceStale,
  type PolicyStaleness,
} from '@/lib/legal/versions'

type UserRow = Database['public']['Tables']['users']['Row']
type ValidRole = 'athlete' | 'team' | 'brand' | 'agent'

export interface PasswordValidationResult {
  valid: boolean
  error?: string
}

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one symbol' }
  }
  return { valid: true }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * The columns of `public.users` the session actually needs (SB-9/FA-4).
 *
 * `select('*')` on the hot path pulled all 17 columns — including the consent
 * and GDPR-erasure timestamps, which have their own dedicated readers
 * (`getPolicyStaleness`, `cancelDeletionOnSignIn`) and are never wanted at the
 * same time as the session identity. Keep this list minimal; widening it costs
 * bandwidth on every authenticated request.
 */
const SESSION_USER_COLUMNS =
  'id, email, email_verified, role, role_locked_at, terms_accepted_at, deactivated_at, deletion_scheduled_at'

/**
 * The projection above, as a type. Narrowing `getUser()`'s return type from the
 * full `UserRow` is deliberate: it makes the projection self-enforcing, so
 * adding a consumer of an unprojected column is a compile error rather than a
 * silent `undefined` at runtime. (`/api/auth/me` is the widest consumer and
 * defines the list.)
 */
export type SessionUser = Pick<
  UserRow,
  | 'id'
  | 'email'
  | 'email_verified'
  | 'role'
  | 'role_locked_at'
  | 'terms_accepted_at'
  | 'deactivated_at'
  | 'deletion_scheduled_at'
>

/**
 * FA-3 / NX-6 — per-request memoisation of the two round-trips `getUser()`
 * costs (`auth.getUser()` against GoTrue, then the `public.users` row).
 *
 * ## Why React's `cache()` and not a module-level Map
 *
 * `cache()` stores its memo in the per-request store React installs for the
 * server render pass (an AsyncLocalStorage context created when the request
 * starts and discarded when it ends). It is therefore structurally impossible
 * for one request's user row to be served to another request — unlike a
 * module-scoped Map, which on a long-lived serverless instance would do exactly
 * that. This is the whole reason for choosing it.
 *
 * Outside a request scope — unit tests, scripts, `next build` data collection —
 * React's fallback dispatcher does not memoise at all and every call re-runs
 * the query. So this is a pure performance change: behaviour is identical, only
 * the number of round-trips differs. `auth.test.ts` asserts both halves.
 *
 * The memo key is the argument list, so deduplication only kicks in when the
 * callers within one request share a client instance — which is why
 * `lib/supabase/server.ts` `createClient()` is itself wrapped in `cache()`.
 * Keying on the client (rather than on the user id alone) is also what keeps an
 * anon-key client and a service-role client from sharing a cache entry.
 */
const cachedAuthUser = cache(async (supabase: SupabaseClient<Database>) => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

const cachedUserRow = cache(
  async (
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<SessionUser | null> => {
    const { data } = await supabase
      .from('users')
      .select(SESSION_USER_COLUMNS)
      .eq('id', userId)
      .single()

    return data
  }
)

export async function getUser(
  supabase: SupabaseClient<Database>
): Promise<SessionUser | null> {
  const user = await cachedAuthUser(supabase)

  if (!user) return null

  return cachedUserRow(supabase, user.id)
}

/**
 * L-7 — assigns a role exactly once, atomically.
 *
 * The guard MUST live in the WHERE clause. The previous implementation read
 * `role_locked_at`, compared it in TypeScript, then issued an unconditional
 * UPDATE — a textbook TOCTOU window: two concurrent role-select submissions
 * both read `null`, both passed the check, and the second write won. A user
 * could therefore land on a role they had already been denied.
 *
 * `UPDATE ... WHERE id = $2 AND role_locked_at IS NULL` collapses check and
 * write into one statement, so Postgres' row lock serialises the two writers
 * and the loser matches zero rows. "Zero rows affected" is therefore the
 * already-locked signal, and is reported with the same AuthError code/message
 * as before so existing callers and tests are unaffected.
 *
 * (Zero rows also covers "no such user" and "RLS denied the write". All three
 * are correctly refusals from this function's point of view — none of them
 * mean the role was set.)
 */
export async function lockRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ValidRole
): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .update({ role, role_locked_at: new Date().toISOString() })
    .eq('id', userId)
    .is('role_locked_at', null)
    .select('id')

  if (error) {
    throw new AuthError('ROLE_UPDATE_FAILED', error.message)
  }

  if (!data || data.length === 0) {
    throw new AuthError(
      'ROLE_ALREADY_LOCKED',
      'Role has already been set and cannot be changed'
    )
  }
}

/**
 * Marks a user's email as verified (SB-11).
 *
 * Exists so `app/api/auth/callback/route.ts` can stop doing
 * `supabase.from('users').update({ email_verified: true })` inline — the last
 * direct-DB-call violation of the CLAUDE.md architecture rule, and the reason
 * `eslint.config.mjs` still carries a named override for that file. Swapping
 * the route's four lines for `await markEmailVerified(supabase, userId)` lets
 * the override be deleted.
 */
export async function markEmailVerified(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('id', userId)

  if (error) {
    throw new AuthError('EMAIL_VERIFY_FAILED', error.message)
  }
}

/**
 * Records acceptance of the Terms and Privacy Policy (CL-5).
 *
 * The versions default to the constants in lib/legal/versions.ts — callers
 * should NOT pass literals. Bumping TERMS_VERSION / PRIVACY_VERSION there is
 * the only change needed to force re-consent, because
 * `getPolicyStaleness()` compares stored acceptance against the same source.
 */
export async function acceptTerms(
  supabase: SupabaseClient<Database>,
  userId: string,
  tcVersion: string = TERMS_VERSION,
  ppVersion: string = PRIVACY_VERSION
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('users')
    .update({
      terms_accepted_at: now,
      terms_version: tcVersion,
      privacy_accepted_at: now,
      privacy_version: ppVersion,
    })
    .eq('id', userId)

  if (error) {
    throw new AuthError('TERMS_UPDATE_FAILED', error.message)
  }
}

/**
 * Fetches the user and reports which policies they must re-accept.
 * Returns `null` when there is no signed-in user.
 */
export async function getPolicyStaleness(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PolicyStaleness> {
  const { data, error } = await supabase
    .from('users')
    .select('terms_version, terms_accepted_at, privacy_version, privacy_accepted_at')
    .eq('id', userId)
    .single()

  if (error) {
    throw new AuthError('POLICY_STATUS_FAILED', error.message)
  }

  return isPolicyAcceptanceStale(data)
}

/** Days between a deletion request and the scheduled erasure (grace period). */
export const DELETION_GRACE_PERIOD_DAYS = 14

export async function requestDeletion(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const now = new Date()
  const scheduledAt = new Date(now)
  scheduledAt.setDate(scheduledAt.getDate() + DELETION_GRACE_PERIOD_DAYS)

  const { error } = await supabase
    .from('users')
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_at: scheduledAt.toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new AuthError('DELETION_REQUEST_FAILED', error.message)
  }
}

export interface ErasureResult {
  user_id: string
  status: 'erased' | 'already_erased' | 'not_found' | 'failed'
  error?: string
}

export interface ErasureSummary {
  processed_at: string
  erased: number
  failed: number
  results: ErasureResult[]
}

/**
 * Runs the scheduled-erasure job (DI-4 / CL-3).
 *
 * Wraps the `process_scheduled_deletions` SECURITY DEFINER function added in
 * 20260720003000_gdpr_erasure.sql. MUST be called with the service-role client
 * (`createAdminClient()`); the function is not executable by anon or
 * authenticated roles.
 */
export async function processScheduledDeletions(
  adminSupabase: SupabaseClient<Database>,
  limit = 100
): Promise<ErasureSummary> {
  // db(): the RPC is not in the generated Database types yet (types/database.ts
  // is regenerated by `npm run supabase:types`).
  const { data, error } = await db(adminSupabase).rpc(
    'process_scheduled_deletions',
    { p_limit: limit }
  )

  if (error) {
    throw new AuthError('ERASURE_JOB_FAILED', (error as { message: string }).message)
  }

  const summary = (data ?? {}) as Partial<ErasureSummary>

  return {
    processed_at: summary.processed_at ?? new Date().toISOString(),
    erased: summary.erased ?? 0,
    failed: summary.failed ?? 0,
    results: summary.results ?? [],
  }
}

/**
 * Cancels a pending erasure (DI-4 / CL-3).
 *
 * Clearing both timestamps takes the user out of the set that
 * `process_scheduled_deletions()` selects, so the erasure never runs. Safe to
 * call when no request is pending — it is a no-op in that case.
 *
 * Call this on every successful sign-in (see `cancelDeletionOnSignIn`) so that
 * a user who simply comes back is not erased, and from an explicit
 * "keep my account" control in settings.
 */
export async function cancelDeletion(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
    .eq('id', userId)

  if (error) {
    throw new AuthError('DELETION_CANCEL_FAILED', error.message)
  }
}

/**
 * Sign-in hook: if the user has a deletion pending and the scheduled time has
 * not yet passed, signing back in withdraws the request and returns true.
 *
 * If `deletion_scheduled_at` is already in the past the request is NOT
 * withdrawn — the erasure is due and the cron job owns it from that point, so a
 * late login cannot resurrect an account that is mid-erasure.
 */
export async function cancelDeletionOnSignIn(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('deletion_requested_at, deletion_scheduled_at')
    .eq('id', userId)
    .single()

  if (error) {
    throw new AuthError('DELETION_STATUS_FAILED', error.message)
  }

  if (!data?.deletion_requested_at && !data?.deletion_scheduled_at) return false

  if (data.deletion_scheduled_at) {
    const scheduled = Date.parse(data.deletion_scheduled_at)
    if (!Number.isNaN(scheduled) && scheduled <= Date.now()) return false
  }

  await cancelDeletion(supabase, userId)
  return true
}
