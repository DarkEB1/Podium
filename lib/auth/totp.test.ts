import { describe, it, expect } from 'vitest'
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  buildOtpauthUrl,
} from './totp'

// RFC 6238 SHA-1 test vector: ASCII secret "12345678901234567890".
const RFC_SECRET_ASCII = '12345678901234567890'
const RFC_SECRET_B32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'))

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 128, 255, 42])
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true)
  })

  it('tolerates lowercase, spaces and padding on decode', () => {
    const enc = base32Encode(Buffer.from('hello'))
    const messy = ` ${enc.toLowerCase()} == `
    expect(base32Decode(messy).toString()).toBe('hello')
  })
})

describe('generateTotp against the RFC 6238 vector', () => {
  // RFC 6238 SHA-1, T=59s -> 8-digit 94287082; the 6-digit truncation is 287082.
  it('produces the known code at T=59s', () => {
    expect(generateTotp(RFC_SECRET_B32, 59_000)).toBe('287082')
  })

  // T=1111111109 -> 8-digit 07081804 -> 6-digit 081804.
  it('produces the known code at T=1111111109s', () => {
    expect(generateTotp(RFC_SECRET_B32, 1_111_111_109_000)).toBe('081804')
  })
})

describe('verifyTotp', () => {
  it('accepts the current code', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    expect(verifyTotp(secret, generateTotp(secret, now), { nowMs: now })).toBe(true)
  })

  it('accepts a code from the previous step within the drift window', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const prev = generateTotp(secret, now - 30_000)
    expect(verifyTotp(secret, prev, { nowMs: now, window: 1 })).toBe(true)
  })

  it('rejects a code outside the window', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const old = generateTotp(secret, now - 120_000)
    expect(verifyTotp(secret, old, { nowMs: now, window: 1 })).toBe(false)
  })

  it('rejects malformed input', () => {
    const secret = generateTotpSecret()
    expect(verifyTotp(secret, 'abcdef')).toBe(false)
    expect(verifyTotp(secret, '12345')).toBe(false)
    expect(verifyTotp(secret, '')).toBe(false)
  })
})

describe('buildOtpauthUrl', () => {
  it('encodes issuer, account and secret', () => {
    const url = buildOtpauthUrl('ABCDEF', 'admin@podium.app', 'Podium')
    expect(url.startsWith('otpauth://totp/Podium:admin%40podium.app')).toBe(true)
    expect(url).toContain('secret=ABCDEF')
    expect(url).toContain('issuer=Podium')
    expect(url).toContain('period=30')
  })
})
