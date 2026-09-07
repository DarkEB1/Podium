import { describe, it, expect } from 'vitest'
import { sha256Hex, signatureAuditHash } from './audit'

describe('audit hashing', () => {
  it('sha256Hex is a stable 64-char lowercase hex of the bytes', () => {
    const h = sha256Hex(Buffer.from('podium'))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe(sha256Hex(Buffer.from('podium')))
  })

  it('signatureAuditHash is deterministic and field-sensitive', () => {
    const base = {
      contractId: 'c1', role: 'brand', typedName: 'Ada', signedAt: '2026-09-07T00:00:00.000Z',
      ip: '1.2.3.4', device: 'UA', consentText: 'I agree',
    }
    const a = signatureAuditHash(base)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(signatureAuditHash(base)).toBe(a)
    expect(signatureAuditHash({ ...base, typedName: 'Bob' })).not.toBe(a)
  })
})
