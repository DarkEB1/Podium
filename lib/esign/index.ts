import { serverEnv } from '@/lib/env'
import { podiumProvider } from './podium'

export type EsignProviderName = 'podium'

export interface SignaturePayload {
  typedName: string
  consentText: string
  signatureImageDataUrl?: string | null
  ip: string | null
  device: string | null
}

export interface EsignProvider {
  name: EsignProviderName
  /** Persist one signer's record for the contract (service-role). */
  recordSignature(contractId: string, role: 'brand' | 'athlete' | 'agent', signerUserId: string, payload: SignaturePayload, signedAt: string): Promise<void>
  /** Generate + store the signed PDF and set document_url/hash. Idempotent; returns null if already finalized. */
  finalizeContract(contractId: string): Promise<{ documentPath: string; documentHash: string } | null>
}

export function provider(): EsignProvider {
  // Only one provider today; the enum keeps the switch honest for future ones.
  switch (serverEnv().ESIGN_PROVIDER) {
    case 'podium':
    default:
      return podiumProvider
  }
}
