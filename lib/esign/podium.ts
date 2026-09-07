import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { STORAGE_BUCKETS } from '@/lib/storage'
import { insertContractSignature } from '@/lib/supabase/contract-signatures'
import { signatureAuditHash } from './audit'
import { finalizeContractDocument } from './finalize'
import type { EsignProvider, SignaturePayload } from './index'

/** Decode a "data:image/png;base64,…" URL to raw bytes, or null if not a data URL. */
function dataUrlToBytes(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  return Buffer.from(m[1], 'base64')
}

async function recordSignature(
  contractId: string,
  role: 'brand' | 'athlete' | 'agent',
  signerUserId: string,
  payload: SignaturePayload,
  signedAt: string
): Promise<void> {
  const admin = createAdminClient()

  // Ensure the contract carries a provider + envelope id (set on first signature).
  const { data: contract } = await admin
    .from('contracts')
    .select('esignature_envelope_id')
    .eq('id', contractId)
    .single()
  if (contract && !contract.esignature_envelope_id) {
    await admin
      .from('contracts')
      .update({ esignature_provider: 'podium', esignature_envelope_id: randomUUID() })
      .eq('id', contractId)
  }

  // Store the drawn-signature image if one was supplied.
  let signatureImagePath: string | null = null
  const pngBytes = dataUrlToBytes(payload.signatureImageDataUrl)
  if (pngBytes) {
    const path = `contracts/${contractId}/signatures/${role}.png`
    const { error } = await admin.storage
      .from(STORAGE_BUCKETS.docs)
      .upload(path, pngBytes, { contentType: 'image/png', upsert: true })
    if (!error) signatureImagePath = path
  }

  const signature_hash = signatureAuditHash({
    contractId, role, typedName: payload.typedName, signedAt,
    ip: payload.ip, device: payload.device, consentText: payload.consentText,
  })

  await insertContractSignature(admin, {
    contract_id: contractId,
    signer_role: role,
    signer_user_id: signerUserId,
    typed_name: payload.typedName,
    signature_image_path: signatureImagePath,
    consent_text: payload.consentText,
    signer_ip: payload.ip,
    signer_device: payload.device,
    signed_at: signedAt,
    signature_hash,
  })
}

async function finalizeContract(
  contractId: string
): Promise<{ documentPath: string; documentHash: string } | null> {
  const admin = createAdminClient()
  const { data: contract, error } = await admin
    .from('contracts')
    .select('id, brand_id, athlete_or_team_id, agent_id, document_url, terms_snapshot')
    .eq('id', contractId)
    .single()
  if (error || !contract) throw new Error(`Contract not found for finalize: ${contractId}`)
  return finalizeContractDocument(admin, contract)
}

export const podiumProvider: EsignProvider = {
  name: 'podium',
  recordSignature,
  finalizeContract,
}
