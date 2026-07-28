/**
 * The "this admin has passed 2FA in this session" cookie (2.4).
 *
 * Signed with Web Crypto (HMAC-SHA256) rather than node:crypto so the SAME
 * verification runs in the edge middleware (the authoritative gate) and in the
 * node route handlers that mint it. The payload binds the cookie to a userId and
 * an expiry, so it cannot be replayed for another admin or used indefinitely.
 *
 * Fails closed: with no secret configured, signing throws and verification
 * returns false, so a misconfigured deployment locks admins out rather than
 * letting anyone in.
 */

export const ADMIN_2FA_COOKIE = 'podium_admin_2fa'
export const ADMIN_2FA_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function secret(): string {
  const s = process.env.ADMIN_2FA_COOKIE_SECRET
  if (!s || s.length < 16) {
    throw new Error('ADMIN_2FA_COOKIE_SECRET is not configured (min 16 chars).')
  }
  return s
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  // Back the view with an explicit ArrayBuffer so the type is a concrete
  // Uint8Array<ArrayBuffer> that crypto.subtle.verify accepts as BufferSource.
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function importKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

/** Mint a cookie value for an admin. Throws if the secret is unset. */
export async function signAdmin2faCookie(userId: string, nowMs: number = Date.now()): Promise<string> {
  const exp = nowMs + ADMIN_2FA_TTL_MS
  const msg = `${userId}.${exp}`
  const key = await importKey('sign')
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return `${msg}.${b64url(sig)}`
}

/** True when the cookie is a valid, unexpired token for exactly this user. */
export async function verifyAdmin2faCookie(
  token: string | undefined,
  userId: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [uid, expStr, sigB64] = parts as [string, string, string]
  if (uid !== userId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < nowMs) return false

  try {
    const key = await importKey('verify')
    return await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(sigB64),
      new TextEncoder().encode(`${uid}.${expStr}`)
    )
  } catch {
    return false
  }
}
