import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type RepLinkRow = Database['public']['Tables']['representation_links']['Row']
type ContractRow = Database['public']['Tables']['contracts']['Row']
type AgentProfileRow = Database['public']['Tables']['agent_profiles']['Row']

export type AgentClient = RepLinkRow
export type AgentDeal = ContractRow

export class AgentError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

// ---------------------------------------------------------------------------
// Clients (representation links)
// ---------------------------------------------------------------------------

export async function getAgentClients(
  supabase: SupabaseClient<Database>,
  agentId: string
): Promise<AgentClient[]> {
  // Active representation links are the agent's roster of clients.
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('representation_links')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new AgentError('AGENT_CLIENTS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as AgentClient[]
}

// ---------------------------------------------------------------------------
// Deal pipeline (contracts the agent is party to)
// ---------------------------------------------------------------------------

export async function getAgentDealPipeline(
  supabase: SupabaseClient<Database>,
  agentId: string
): Promise<AgentDeal[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('contracts')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new AgentError('AGENT_PIPELINE_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as AgentDeal[]
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function applyForVerification(
  supabase: SupabaseClient<Database>,
  agentId: string
): Promise<AgentProfileRow> {
  // Moves the agent into the 'pending' verification queue; an admin promotes to
  // 'verified'. We never let the caller set 'verified' directly.
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('agent_profiles')
    .update({ verification_status: 'pending' })
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new AgentError('AGENT_NOT_FOUND', 'Agent profile not found')
    }
    throw new AgentError('AGENT_VERIFICATION_FAILED', (error as { message: string }).message)
  }

  return data as AgentProfileRow
}
