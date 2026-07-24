import { createHmac, timingSafeEqual } from 'crypto'

/**
 * One-click unsubscribe tokens (CL-4).
 *
 * An unsubscribe link is followed from a mail client, where the user is NOT
 * signed in — so the link itself must carry proof of who it belongs to, without
 * being forgeable into someone else's unsubscribe. The token is
 * `<userId>.<purpose>.<hmac>`, where the HMAC is keyed on a server secret. A
 * recipient cannot mint a token for another user, and cannot alter the userId
 * or purpose without invalidating the signature.
 *
 * Deliberately NOT time-limited: an unsubscribe link at the bottom of a
 * six-month-old email must still work — that is a legal expectation under PECR,
 * not a nicety. The token grants exactly one capability (stop emailing me), so
 * it does not need the short lifetime a session token would.
 *
 * When `UNSUBSCRIBE_SECRET` is unset the functions fail closed: `sign` throws
 * (a link that cannot be verified must never be emitted) and `verify` returns
 * null (no token can be trusted). This is caught at the env layer, which
 * documents the variable.
 */

export type UnsubscribePurpose = 'all' | 'marketing'

function secret(): string {
  const value = process.env.UNSUBSCRIBE_SECRET
  if (!value || value.length < 16) {
    throw new Error(
      'UNSUBSCRIBE_SECRET is not configured (min 16 chars). Refusing to mint an unverifiable unsubscribe link.'
    )
  }
  return value
}

function computeMac(userId: string, purpose: UnsubscribePurpose): string {
  return createHmac('sha256', secret())
    .update(`${userId}:${purpose}`)
    .digest('base64url')
}

/** Mint an unsubscribe token for a user + purpose. Throws if the secret is unset. */
export function signUnsubscribeToken(userId: string, purpose: UnsubscribePurpose = 'all'): string {
  return `${userId}.${purpose}.${computeMac(userId, purpose)}`
}

export interface UnsubscribeClaim {
  userId: string
  purpose: UnsubscribePurpose
}

/**
 * Verify a token and return its claim, or null if it is malformed, has an
 * unknown purpose, or fails the signature check. Constant-time MAC comparison.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeClaim | null {
  const parts = (token ?? '').split('.')
  if (parts.length !== 3) return null
  const [userId, purpose, mac] = parts as [string, string, string]

  if (purpose !== 'all' && purpose !== 'marketing') return null
  if (!userId) return null

  let expected: string
  try {
    expected = computeMac(userId, purpose)
  } catch {
    // Secret unset: no token can be trusted.
    return null
  }

  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return { userId, purpose }
}
