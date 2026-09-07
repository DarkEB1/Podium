import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { renderContractPdf, type ContractPdfParty, type ContractPdfSignature } from './pdf'
import { sha256Hex } from './audit'
import { getContractSignatures } from '@/lib/supabase/contract-signatures'
import { resolveDisplayNames, nameOf, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { STORAGE_BUCKETS } from '@/lib/storage'

type ContractRow = Pick<
  Database['public']['Tables']['contracts']['Row'],
  'id' | 'brand_id' | 'athlete_or_team_id' | 'agent_id' | 'document_url' | 'terms_snapshot'
>

function termsString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    const t = (v as { text?: unknown }).text
    if (typeof t === 'string') return t.trim() || null
    return JSON.stringify(v)
  }
  return String(v)
}

/**
 * Generate the signed contract PDF from terms_snapshot + captured signatures,
 * store it under docs/contracts/<id>/, and write document_url + document_hash.
 * Idempotent: returns null when document_url is already set. Does not change
 * status or fire notifications — the sign route + retain trigger own those.
 */
export async function finalizeContractDocument(
  admin: SupabaseClient<Database>,
  contract: ContractRow
): Promise<{ documentPath: string; documentHash: string } | null> {
  if (contract.document_url) return null

  const snapshot = (contract.terms_snapshot ?? {}) as Record<string, unknown>
  const signatureRows = await getContractSignatures(admin, contract.id)

  const ids = [contract.brand_id, contract.athlete_or_team_id, contract.agent_id].filter(
    (x): x is string => Boolean(x)
  )
  const names = await resolveDisplayNames(admin, ids)

  const parties: ContractPdfParty[] = [
    { role: 'brand', displayName: nameOf(names, contract.brand_id, FALLBACK_OTHER_NAME) },
    { role: 'athlete', displayName: nameOf(names, contract.athlete_or_team_id, FALLBACK_OTHER_NAME) },
  ]
  if (contract.agent_id) {
    parties.push({ role: 'agent', displayName: nameOf(names, contract.agent_id, FALLBACK_OTHER_NAME) })
  }

  const signatures: ContractPdfSignature[] = signatureRows.map((s) => ({
    role: s.signer_role,
    typedName: s.typed_name,
    signedAt: s.signed_at,
    ip: s.signer_ip,
    signatureHash: s.signature_hash,
  }))

  const pdf = await renderContractPdf({
    contractId: contract.id,
    terms: {
      title: String(snapshot.title ?? 'Sponsorship Agreement'),
      payAmount: Number(snapshot.pay_amount ?? 0),
      payCurrency: String(snapshot.pay_currency ?? 'GBP'),
      payType: String(snapshot.pay_type ?? ''),
      timelineStart: termsString(snapshot.timeline_start),
      timelineEnd: termsString(snapshot.timeline_end),
      deliverables: termsString(snapshot.deliverables),
      usageRights: termsString(snapshot.usage_rights),
      additionalTerms: termsString(snapshot.additional_terms),
    },
    parties,
    signatures,
  })

  const documentHash = sha256Hex(pdf)
  const documentPath = `contracts/${contract.id}/signed-${documentHash.slice(0, 8)}.pdf`

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.docs)
    .upload(documentPath, pdf, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    throw new Error(`Failed to store signed PDF: ${uploadError.message}`)
  }

  const { error: updateError } = await admin
    .from('contracts')
    .update({ document_url: documentPath, document_hash: documentHash })
    .eq('id', contract.id)
  if (updateError) {
    throw new Error(`Failed to write document pointer: ${updateError.message}`)
  }

  return { documentPath, documentHash }
}
