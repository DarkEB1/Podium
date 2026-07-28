import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { generateTotpSecret, verifyTotp, buildOtpauthUrl } from '@/lib/auth/totp'
import { encryptSecret, decryptSecret } from '@/lib/auth/secret-crypto'

/**
 * TOTP two-factor state over the auth_2fa table (2.4).
 *
 * Every function takes the service-role admin client: the secret column is
 * written service-role only, and verification decrypts it, which must never
 * happen in a user-scoped context. The secret is stored AES-GCM-sealed; recovery
 * codes are stored as SHA-256 hashes and shown in plaintext exactly once.
 */

export class TwoFactorError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'TwoFactorError'
  }
}

const RECOVERY_CODE_COUNT = 10

type Row = {
  user_id: string
  secret: string
  enabled: boolean
  recovery_codes: string[]
  confirmed_at: string | null
}

function normaliseRecovery(code: string): string {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function hashRecovery(code: string): string {
  return createHash('sha256').update(normaliseRecovery(code)).digest('hex')
}

/** Ten grouped one-time recovery codes, e.g. "A1B2C-3D4E5". */
function generateRecoveryCodes(): string[] {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I/L
  const codes: string[] = []
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const raw = randomBytes(10)
    let s = ''
    for (const b of raw) s += alphabet[b % alphabet.length]
    codes.push(`${s.slice(0, 5)}-${s.slice(5, 10)}`)
  }
  return codes
}

async function fetchRow(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<Row | null> {
  const { data, error } = await (admin as SupabaseClient)
    .from('auth_2fa')
    .select('user_id, secret, enabled, recovery_codes, confirmed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new TwoFactorError('FETCH_FAILED', (error as { message: string }).message)
  return (data as Row | null) ?? null
}

export interface TwoFactorStatus {
  enabled: boolean
  enrolled: boolean
  confirmedAt: string | null
}

export async function getTwoFactorStatus(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<TwoFactorStatus> {
  const row = await fetchRow(admin, userId)
  return {
    enrolled: !!row,
    enabled: !!row?.enabled,
    confirmedAt: row?.confirmed_at ?? null,
  }
}

export async function isTwoFactorEnabled(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  return (await getTwoFactorStatus(admin, userId)).enabled
}

/**
 * Create (or replace) a pending, not-yet-enabled secret and return what the
 * admin needs to add it to their authenticator. Re-enrolling before activation
 * simply overwrites the pending secret.
 */
export async function beginEnrollment(
  admin: SupabaseClient<Database>,
  userId: string,
  account: string
): Promise<{ secret: string; otpauthUrl: string }> {
  const secret = generateTotpSecret()

  const { error } = await (admin as SupabaseClient).from('auth_2fa').upsert(
    {
      user_id: userId,
      secret: encryptSecret(secret),
      enabled: false,
      recovery_codes: [],
      confirmed_at: null,
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new TwoFactorError('ENROLL_FAILED', (error as { message: string }).message)

  return { secret, otpauthUrl: buildOtpauthUrl(secret, account) }
}

/**
 * Confirm a code against the pending secret and enable 2FA. Returns the plaintext
 * recovery codes, which are shown to the admin once and never again.
 */
export async function activateTwoFactor(
  admin: SupabaseClient<Database>,
  userId: string,
  token: string
): Promise<{ recoveryCodes: string[] }> {
  const row = await fetchRow(admin, userId)
  if (!row) throw new TwoFactorError('NOT_ENROLLED', 'Start 2FA setup before activating it')

  if (!verifyTotp(decryptSecret(row.secret), token)) {
    throw new TwoFactorError('INVALID_CODE', 'That code is not valid. Try the current one.')
  }

  const recoveryCodes = generateRecoveryCodes()
  const { error } = await (admin as SupabaseClient)
    .from('auth_2fa')
    .update({
      enabled: true,
      confirmed_at: new Date().toISOString(),
      recovery_codes: recoveryCodes.map(hashRecovery),
    })
    .eq('user_id', userId)
  if (error) throw new TwoFactorError('ACTIVATE_FAILED', (error as { message: string }).message)

  return { recoveryCodes }
}

/** Turn 2FA off and wipe the stored secret and recovery codes. */
export async function disableTwoFactor(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await (admin as SupabaseClient).from('auth_2fa').delete().eq('user_id', userId)
  if (error) throw new TwoFactorError('DISABLE_FAILED', (error as { message: string }).message)
}

/**
 * Verify a login challenge: a live TOTP code, or a one-time recovery code (which
 * is consumed on use). Returns false for a disabled/unenrolled user.
 */
export async function verifyTwoFactorLogin(
  admin: SupabaseClient<Database>,
  userId: string,
  token: string
): Promise<boolean> {
  const row = await fetchRow(admin, userId)
  if (!row || !row.enabled) return false

  if (verifyTotp(decryptSecret(row.secret), token)) return true

  // Recovery-code path: match a stored hash, then consume it.
  const hash = hashRecovery(token)
  if (normaliseRecovery(token).length >= 8 && row.recovery_codes.includes(hash)) {
    const remaining = row.recovery_codes.filter((h) => h !== hash)
    const { error } = await (admin as SupabaseClient)
      .from('auth_2fa')
      .update({ recovery_codes: remaining })
      .eq('user_id', userId)
    if (error) throw new TwoFactorError('CONSUME_FAILED', (error as { message: string }).message)
    return true
  }

  return false
}
