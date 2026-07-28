import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * TOTP (RFC 6238) with zero dependencies (2.4 admin 2FA).
 *
 * Implemented directly on node crypto rather than pulling otplib/speakeasy, in
 * keeping with the project's zero-new-dependency ethos (see lib/email/provider
 * for the same call on Resend). SHA-1, 30-second step, 6 digits: the defaults
 * every authenticator app (Google Authenticator, 1Password, Authy) assumes.
 */

const STEP_SECONDS = 30
const DIGITS = 6
const SECRET_BYTES = 20 // 160 bits, the RFC-recommended SHA-1 key length

// RFC 4648 base32 alphabet.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Encode bytes as unpadded base32 (the format authenticator apps expect). */
export function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

/** Decode an (optionally padded/spaced) base32 string to bytes. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A fresh random base32 TOTP secret. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES))
}

function hotp(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32)
  const buf = Buffer.alloc(8)
  // 8-byte big-endian counter. Bitwise math is 32-bit, so split hi/lo words.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)

  const digest = createHmac('sha1', key).update(buf).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

/** The current TOTP code for a secret. `nowMs` is injectable for tests. */
export function generateTotp(secretB32: string, nowMs: number = Date.now()): string {
  return hotp(secretB32, Math.floor(nowMs / 1000 / STEP_SECONDS))
}

/**
 * Verify a submitted code, tolerating clock drift of `window` steps either side
 * (default ±1 = ±30s). Constant-time per-candidate comparison so a near-miss and
 * a total miss take the same time.
 */
export function verifyTotp(
  secretB32: string,
  token: string,
  opts: { window?: number; nowMs?: number } = {}
): boolean {
  const window = opts.window ?? 1
  const nowMs = opts.nowMs ?? Date.now()
  const candidate = (token ?? '').trim()
  if (!/^\d{6}$/.test(candidate)) return false

  const counter = Math.floor(nowMs / 1000 / STEP_SECONDS)
  let ok = false
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secretB32, counter + i)
    const a = Buffer.from(expected)
    const b = Buffer.from(candidate)
    // Iterate the full window (no early return) to keep timing flat.
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true
  }
  return ok
}

/** The otpauth:// URI an authenticator app scans or imports. */
export function buildOtpauthUrl(secretB32: string, account: string, issuer = 'Podium'): string {
  // Keep the issuer:account colon literal (RFC / authenticator convention);
  // encode each part so an '@' or space in the account cannot break the label.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
