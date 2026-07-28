import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptSecret, decryptSecret } from './secret-crypto'

const KEY = 'a'.repeat(64) // 32 bytes of 0xaa in hex

describe('secret-crypto', () => {
  beforeEach(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = KEY
  })
  afterEach(() => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
  })

  it('round-trips a secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const sealed = encryptSecret(secret)
    expect(sealed).not.toContain(secret)
    expect(decryptSecret(sealed)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('rejects a tampered ciphertext', () => {
    const sealed = encryptSecret('hunter2')
    const [iv, tag, data] = sealed.split('.')
    const flipped = data!.slice(0, -2) + (data!.endsWith('AA') ? 'BB' : 'AA')
    expect(() => decryptSecret(`${iv}.${tag}.${flipped}`)).toThrow()
  })

  it('fails closed when the key is not configured', () => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
    expect(() => encryptSecret('x')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY/)
  })

  it('rejects a malformed sealed value', () => {
    expect(() => decryptSecret('not-three-parts')).toThrow()
  })
})
