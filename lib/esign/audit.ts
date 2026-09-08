import { createHash } from 'node:crypto'

/** Lowercase hex SHA-256 of raw bytes (used for the signed-PDF document hash). */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export interface SignatureAuditInput {
  contractId: string
  role: string
  typedName: string
  signedAt: string
  ip: string | null
  device: string | null
  consentText: string
}

/**
 * Deterministic per-signature audit hash. Canonicalises the signer facts into a
 * pipe-delimited string (nulls become empty) so the same signature always hashes
 * the same, and any tampering with a field changes the hash.
 */
export function signatureAuditHash(input: SignatureAuditInput): string {
  const canonical = [
    input.contractId,
    input.role,
    input.typedName,
    input.signedAt,
    input.ip ?? '',
    input.device ?? '',
    input.consentText,
  ].join('|')
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
