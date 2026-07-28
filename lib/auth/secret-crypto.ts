import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Authenticated encryption for TOTP secrets at rest (2.4).
 *
 * auth_2fa.secret is documented as an encrypted value. A leaked database row
 * must not hand an attacker a working TOTP seed, so the base32 secret is sealed
 * with AES-256-GCM under a server-only key before it is written, and only the
 * service-role 2FA code ever decrypts it.
 *
 * Fails closed: with no key configured, `encryptSecret` / `decryptSecret` throw
 * rather than silently storing a recoverable secret.
 */

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

function key(): Buffer {
  const hex = process.env.TWO_FACTOR_ENCRYPTION_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'TWO_FACTOR_ENCRYPTION_KEY is not configured (expected 64 hex chars = 32 bytes). ' +
        'Generate one with `openssl rand -hex 32`.'
    )
  }
  return Buffer.from(hex, 'hex')
}

/** Seal a plaintext secret. Output: `iv.tag.ciphertext`, all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

/** Open a sealed secret. Throws if the key is unset or the ciphertext is tampered. */
export function decryptSecret(sealed: string): string {
  const parts = (sealed ?? '').split('.')
  if (parts.length !== 3) throw new Error('Malformed encrypted secret')
  const [ivB64, tagB64, dataB64] = parts as [string, string, string]

  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()])
  return dec.toString('utf8')
}
