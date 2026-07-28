import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Guardian consent (punch-list 2.3).
 *
 * Under-18 athletes collect a guardian's details at onboarding, but consent was
 * never enforced. This module owns the one-time blanket consent: an athlete
 * requests it, the guardian follows an emailed capability link, and accepting it
 * stamps `athlete_profiles.guardian_accepted_at`. The DB trigger added in
 * 20260728000000_guardian_consent_enforcement.sql is what actually blocks a
 * signature until that stamp exists; this module is the flow that sets it.
 *
 * The guardian is NOT a signed-in user. The emailed link carries a
 * high-entropy random token; only its SHA-256 hash is stored, so a leaked
 * database row cannot be turned back into a working link. Every function here
 * takes the service-role admin client, because the guardian has no session and
 * `guardian_consent_tokens` denies all non-service access via RLS.
 */

export class GuardianConsentError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'GuardianConsentError'
  }
}

const TOKEN_BYTES = 32
export const DEFAULT_TTL_DAYS = 7

/** A URL-safe, high-entropy raw token. Emailed to the guardian, never stored. */
export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** SHA-256 hex of a raw token. Only this is persisted. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

type AthleteConsentRow = {
  user_id: string
  is_under_18: boolean
  guardian_accepted_at: string | null
  guardian_email: string | null
  guardian_name: string | null
  display_name: string | null
  full_legal_name: string | null
}

function athleteDisplayName(a: {
  display_name: string | null
  full_legal_name: string | null
}): string {
  return a.display_name?.trim() || a.full_legal_name?.trim() || 'the athlete'
}

async function fetchAthleteConsent(
  admin: SupabaseClient<Database>,
  athleteUserId: string
): Promise<AthleteConsentRow | null> {
  const { data, error } = await (admin as SupabaseClient)
    .from('athlete_profiles')
    .select(
      'user_id, is_under_18, guardian_accepted_at, guardian_email, guardian_name, display_name, full_legal_name'
    )
    .eq('user_id', athleteUserId)
    .maybeSingle()

  if (error) {
    throw new GuardianConsentError('ATHLETE_FETCH_FAILED', (error as { message: string }).message)
  }
  return (data as AthleteConsentRow | null) ?? null
}

export interface ConsentRequest {
  rawToken: string
  guardianEmail: string
  guardianName: string | null
  athleteName: string
  expiresAt: string
}

/**
 * Create a consent-request token for an under-18 athlete and return everything
 * the caller needs to email the guardian. Refuses when the athlete is not under
 * 18, has no guardian email on file, or has already been consented for.
 */
export async function requestGuardianConsent(
  admin: SupabaseClient<Database>,
  athleteUserId: string,
  opts: { ttlDays?: number } = {}
): Promise<ConsentRequest> {
  const athlete = await fetchAthleteConsent(admin, athleteUserId)
  if (!athlete) {
    throw new GuardianConsentError('ATHLETE_NOT_FOUND', 'Athlete profile not found')
  }
  if (!athlete.is_under_18) {
    throw new GuardianConsentError('NOT_UNDER_18', 'Guardian consent applies only to under-18 athletes')
  }
  if (athlete.guardian_accepted_at) {
    throw new GuardianConsentError('ALREADY_CONSENTED', 'A guardian has already consented for this athlete')
  }
  const guardianEmail = athlete.guardian_email?.trim()
  if (!guardianEmail) {
    throw new GuardianConsentError('NO_GUARDIAN_EMAIL', 'No guardian email is on file for this athlete')
  }

  const ttlDays = opts.ttlDays ?? DEFAULT_TTL_DAYS
  const rawToken = generateRawToken()
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await (admin as SupabaseClient).from('guardian_consent_tokens').insert({
    athlete_user_id: athleteUserId,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
  })
  if (error) {
    throw new GuardianConsentError('TOKEN_INSERT_FAILED', (error as { message: string }).message)
  }

  return {
    rawToken,
    guardianEmail,
    guardianName: athlete.guardian_name,
    athleteName: athleteDisplayName(athlete),
    expiresAt,
  }
}

type TokenRow = {
  id: string
  athlete_user_id: string
  token_hash: string
  expires_at: string
  consumed_at: string | null
}

async function fetchTokenByRaw(
  admin: SupabaseClient<Database>,
  rawToken: string
): Promise<TokenRow | null> {
  if (!rawToken) return null
  const { data, error } = await (admin as SupabaseClient)
    .from('guardian_consent_tokens')
    .select('id, athlete_user_id, token_hash, expires_at, consumed_at')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()

  if (error) {
    throw new GuardianConsentError('TOKEN_FETCH_FAILED', (error as { message: string }).message)
  }
  return (data as TokenRow | null) ?? null
}

export type ConsentTokenStatus =
  | { status: 'valid'; athleteUserId: string; athleteName: string }
  | { status: 'expired' }
  | { status: 'consumed' }
  | { status: 'invalid' }

/**
 * Non-mutating check used by the public guardian page: is this link usable, and
 * for which athlete? Never reveals anything for an unknown token.
 */
export async function getConsentTokenStatus(
  admin: SupabaseClient<Database>,
  rawToken: string
): Promise<ConsentTokenStatus> {
  const token = await fetchTokenByRaw(admin, rawToken)
  if (!token) return { status: 'invalid' }
  if (token.consumed_at) return { status: 'consumed' }
  if (new Date(token.expires_at).getTime() <= Date.now()) return { status: 'expired' }

  const athlete = await fetchAthleteConsent(admin, token.athlete_user_id)
  if (!athlete) return { status: 'invalid' }
  return { status: 'valid', athleteUserId: token.athlete_user_id, athleteName: athleteDisplayName(athlete) }
}

export interface ConsentAccepted {
  athleteUserId: string
  athleteName: string
}

/**
 * Consume a token: stamp the athlete's `guardian_accepted_at` and mark the token
 * used. Idempotent when the token is already consumed and the athlete is already
 * consented (a guardian who double-clicks the link succeeds both times).
 */
export async function acceptGuardianConsent(
  admin: SupabaseClient<Database>,
  rawToken: string
): Promise<ConsentAccepted> {
  const token = await fetchTokenByRaw(admin, rawToken)
  if (!token) {
    throw new GuardianConsentError('TOKEN_INVALID', 'This consent link is not valid')
  }
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    throw new GuardianConsentError('TOKEN_EXPIRED', 'This consent link has expired')
  }

  const athlete = await fetchAthleteConsent(admin, token.athlete_user_id)
  if (!athlete) {
    throw new GuardianConsentError('ATHLETE_NOT_FOUND', 'Athlete profile not found')
  }
  const athleteName = athleteDisplayName(athlete)

  // Idempotent replay: token already consumed and consent already recorded.
  if (token.consumed_at && athlete.guardian_accepted_at) {
    return { athleteUserId: token.athlete_user_id, athleteName }
  }
  if (token.consumed_at && !athlete.guardian_accepted_at) {
    // Token was consumed but the stamp is missing (e.g. a prior partial write):
    // fall through and set it rather than refusing a legitimate guardian.
  }

  const now = new Date().toISOString()

  const { error: stampError } = await (admin as SupabaseClient)
    .from('athlete_profiles')
    .update({ guardian_accepted_at: now })
    .eq('user_id', token.athlete_user_id)
  if (stampError) {
    throw new GuardianConsentError('CONSENT_STAMP_FAILED', (stampError as { message: string }).message)
  }

  const { error: consumeError } = await (admin as SupabaseClient)
    .from('guardian_consent_tokens')
    .update({ consumed_at: now })
    .eq('id', token.id)
  if (consumeError) {
    throw new GuardianConsentError('TOKEN_CONSUME_FAILED', (consumeError as { message: string }).message)
  }

  return { athleteUserId: token.athlete_user_id, athleteName }
}

export interface GuardianDealNotice {
  to: string
  guardianName: string | null
  athleteName: string
  brandName: string
  dealTitle: string
  amountFormatted: string
}

/**
 * pay_amount is stored in MAJOR currency units and the deals UI formats it
 * directly, so this mirrors that rather than lib/email's minor-unit formatAmount.
 */
function formatMajorAmount(amount: number, currency: string): string {
  const code = (currency || 'GBP').toUpperCase()
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

/**
 * Assemble the per-deal guardian notice for a just-signed contract, or null when
 * no notice is due (adult athlete, team, or no guardian email on file). Every
 * lookup is best-effort: a missing brand or proposal degrades to a neutral label
 * rather than suppressing the notice.
 */
export async function buildGuardianDealNotice(
  admin: SupabaseClient<Database>,
  contract: { brand_id: string; athlete_or_team_id: string; proposal_id: string | null }
): Promise<GuardianDealNotice | null> {
  const athlete = await fetchAthleteConsent(admin, contract.athlete_or_team_id)
  if (!athlete || !athlete.is_under_18) return null
  const to = athlete.guardian_email?.trim()
  if (!to) return null

  let brandName = 'the brand'
  const { data: brand } = await (admin as SupabaseClient)
    .from('brand_profiles')
    .select('company_name')
    .eq('user_id', contract.brand_id)
    .maybeSingle()
  if ((brand as { company_name?: string } | null)?.company_name) {
    brandName = (brand as { company_name: string }).company_name
  }

  let dealTitle = 'a sponsorship deal'
  let amountFormatted = ''
  if (contract.proposal_id) {
    const { data: proposal } = await (admin as SupabaseClient)
      .from('proposals')
      .select('title, pay_amount, pay_currency')
      .eq('id', contract.proposal_id)
      .maybeSingle()
    const p = proposal as { title?: string; pay_amount?: number; pay_currency?: string } | null
    if (p) {
      if (p.title) dealTitle = p.title
      if (typeof p.pay_amount === 'number') {
        amountFormatted = formatMajorAmount(p.pay_amount, p.pay_currency ?? 'GBP')
      }
    }
  }

  return {
    to,
    guardianName: athlete.guardian_name,
    athleteName: athleteDisplayName(athlete),
    brandName,
    dealTitle,
    amountFormatted: amountFormatted || 'See Podium for details',
  }
}
