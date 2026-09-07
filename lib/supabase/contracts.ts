import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * SB-11 helpers for `contracts` — the webhook route and the document route
 * used to issue `.from('contracts')` directly; both now go through here.
 */

/** Look up a contract by its e-signature envelope id. Null on no row (PGRST116) or error. */
export async function getContractByEsignEnvelopeId(
  admin: SupabaseClient<Database>,
  envelopeId: string
): Promise<{ id: string; esignature_envelope_id: string | null } | null> {
  const { data, error } = await admin
    .from('contracts')
    .select('id, esignature_envelope_id')
    .eq('esignature_envelope_id', envelopeId)
    .single()
  if (error || !data) return null
  return data
}

/** Mark a contract terminated (declined/voided webhook events). */
export async function terminateContract(
  admin: SupabaseClient<Database>,
  id: string,
  reason: string
): Promise<void> {
  await admin
    .from('contracts')
    .update({
      status: 'terminated',
      terminated_at: new Date().toISOString(),
      termination_reason: reason,
    })
    .eq('id', id)
}

/**
 * RLS-scoped contract lookup for the "View / Download PDF" route — uses
 * whichever client is passed (the caller's user client), so a non-participant
 * still gets null back exactly as a raw `.from('contracts')` select would.
 * Null on no row (PGRST116) or error.
 */
export async function getContractDocumentInfo(
  client: SupabaseClient<Database>,
  contractId: string
): Promise<{ id: string; status: string; document_url: string | null } | null> {
  const { data, error } = await client
    .from('contracts')
    .select('id, status, document_url')
    .eq('id', contractId)
    .single()
  if (error || !data) return null
  return data
}
