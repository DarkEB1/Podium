import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type SignerRole = 'brand' | 'athlete' | 'agent'
export type ContractSignatureRow =
  Database['public']['Tables']['contract_signatures']['Row']
export type ContractSignatureInsert =
  Database['public']['Tables']['contract_signatures']['Insert']

export class ContractSignatureError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ContractSignatureError'
  }
}

/** Insert one signer's audit row (service-role client only — RLS has no write policy). */
export async function insertContractSignature(
  admin: SupabaseClient<Database>,
  row: ContractSignatureInsert
): Promise<ContractSignatureRow> {
  const { data, error } = await admin
    .from('contract_signatures')
    .insert(row)
    .select()
    .single()
  if (error || !data) {
    throw new ContractSignatureError(
      'INSERT_FAILED',
      error?.message ?? 'Failed to record signature'
    )
  }
  return data
}

/** All signatures for a contract, oldest first. */
export async function getContractSignatures(
  client: SupabaseClient<Database>,
  contractId: string
): Promise<ContractSignatureRow[]> {
  const { data, error } = await client
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: true })
  if (error) {
    throw new ContractSignatureError('SELECT_FAILED', error.message)
  }
  return data ?? []
}
