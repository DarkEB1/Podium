import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']
type ContractRow = Database['public']['Tables']['contracts']['Row']

export class DealsError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DealsError'
  }
}

export interface ProposalPayload {
  title: string
  deliverables?: Json
  pay_amount: number
  pay_currency?: string
  pay_type: Database['public']['Enums']['pay_type']
  timeline_start?: string | null
  timeline_end?: string | null
  usage_rights?: Json | null
  additional_terms?: string | null
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export async function sendProposal(
  supabase: SupabaseClient<Database>,
  matchId: string,
  senderId: string,
  payload: ProposalPayload
): Promise<ProposalRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('proposals')
    .insert({
      match_id: matchId,
      sender_id: senderId,
      ...payload,
    })
    .select()
    .single()

  if (error) {
    throw new DealsError('PROPOSAL_INSERT_FAILED', (error as { message: string }).message)
  }

  return data as ProposalRow
}

export async function getProposals(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<ProposalRow[]> {
  // Pre-check match existence for a clean MATCH_NOT_FOUND error; RLS alone would return
  // an empty array for non-participants, which is indistinguishable from a valid empty match.
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error: matchError } = await (supabase as SupabaseClient)
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .single()

  if (matchError) {
    throw new DealsError('MATCH_NOT_FOUND', 'Match not found or not accessible')
  }

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('proposals')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new DealsError('PROPOSALS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ProposalRow[]
}

export async function respondToProposal(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  proposalId: string,
  responderId: string,
  action: 'accepted' | 'declined'
): Promise<ProposalRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: existing, error: fetchError } = await (supabase as SupabaseClient)
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchError) {
    if ((fetchError as { code?: string }).code === 'PGRST116') {
      throw new DealsError('PROPOSAL_NOT_FOUND', 'Proposal not found or not accessible')
    }
    throw new DealsError('PROPOSAL_FETCH_FAILED', (fetchError as { message: string }).message)
  }

  const proposal = existing as ProposalRow

  if (proposal.status !== 'pending') {
    throw new DealsError('PROPOSAL_NOT_PENDING', 'Proposal is not in pending status')
  }

  if (proposal.sender_id === responderId) {
    throw new DealsError('NOT_RECIPIENT', 'Sender cannot respond to their own proposal')
  }

  const now = new Date().toISOString()

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: updated, error: updateError } = await (supabase as SupabaseClient)
    .from('proposals')
    .update({ status: action, responded_at: now })
    .eq('id', proposalId)
    .select()
    .single()

  if (updateError) {
    throw new DealsError('PROPOSAL_UPDATE_FAILED', (updateError as { message: string }).message)
  }

  if (action === 'accepted') {
    // Fetch only the participant columns needed for contract creation
    // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
    const { data: match, error: matchError } = await (supabase as SupabaseClient)
      .from('matches')
      .select('user_a_id, user_b_id')
      .eq('id', proposal.match_id)
      .single()

    if (matchError) {
      throw new DealsError('MATCH_NOT_FOUND', 'Match not found when creating contract')
    }

    const matchRow = match as { user_a_id: string; user_b_id: string }

    // Determine brand vs athlete from match participants; proposal sender is always the brand
    const brandId = proposal.sender_id
    const athleteOrTeamId =
      matchRow.user_a_id === brandId ? matchRow.user_b_id : matchRow.user_a_id

    // Contracts INSERT is service-role only (no client RLS policy) — adminSupabase bypasses RLS
    // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
    const { error: contractError } = await (adminSupabase as SupabaseClient)
      .from('contracts')
      .insert({
        proposal_id: proposalId,
        match_id: proposal.match_id,
        brand_id: brandId,
        athlete_or_team_id: athleteOrTeamId,
      })
      .select()
      .single()

    if (contractError) {
      throw new DealsError(
        'CONTRACT_CREATE_FAILED',
        (contractError as { message: string }).message
      )
    }
  }

  return updated as ProposalRow
}

export async function counterProposal(
  supabase: SupabaseClient<Database>,
  parentProposalId: string,
  senderId: string,
  payload: ProposalPayload
): Promise<ProposalRow> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: existing, error: fetchError } = await (supabase as SupabaseClient)
    .from('proposals')
    .select('*')
    .eq('id', parentProposalId)
    .single()

  if (fetchError) {
    if ((fetchError as { code?: string }).code === 'PGRST116') {
      throw new DealsError('PROPOSAL_NOT_FOUND', 'Proposal not found or not accessible')
    }
    throw new DealsError('PROPOSAL_FETCH_FAILED', (fetchError as { message: string }).message)
  }

  const parent = existing as ProposalRow

  if (parent.status !== 'pending') {
    throw new DealsError('PROPOSAL_NOT_PENDING', 'Proposal is not in pending status')
  }

  if (parent.sender_id === senderId) {
    throw new DealsError('NOT_RECIPIENT', 'Sender cannot counter their own proposal')
  }

  const now = new Date().toISOString()

  // Mark parent as countered before inserting the counter-proposal
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error: updateError } = await (supabase as SupabaseClient)
    .from('proposals')
    .update({ status: 'countered', responded_at: now })
    .eq('id', parentProposalId)
    .select()
    .single()

  if (updateError) {
    throw new DealsError('PROPOSAL_UPDATE_FAILED', (updateError as { message: string }).message)
  }

  // Insert counter-proposal with reference to the parent
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: counter, error: insertError } = await (supabase as SupabaseClient)
    .from('proposals')
    .insert({
      match_id: parent.match_id,
      sender_id: senderId,
      parent_proposal_id: parentProposalId,
      ...payload,
    })
    .select()
    .single()

  if (insertError) {
    throw new DealsError('COUNTER_INSERT_FAILED', (insertError as { message: string }).message)
  }

  return counter as ProposalRow
}

export async function withdrawProposal(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  senderId: string
): Promise<void> {
  const now = new Date().toISOString()

  // responded_at records when the status last changed; on withdraw this captures the withdrawal time
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error } = await (supabase as SupabaseClient)
    .from('proposals')
    .update({ status: 'withdrawn', responded_at: now })
    .eq('id', proposalId)
    .eq('sender_id', senderId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new DealsError(
        'PROPOSAL_NOT_FOUND',
        'Proposal not found, not owned by sender, or not pending'
      )
    }
    throw new DealsError('PROPOSAL_WITHDRAW_FAILED', (error as { message: string }).message)
  }
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export async function getProposalsForUser(
  supabase: SupabaseClient<Database>,
  _userId: string
): Promise<ProposalRow[]> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new DealsError('PROPOSALS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ProposalRow[]
}

export async function signContract(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  contractId: string,
  userId: string
): Promise<ContractRow> {
  const { data: existing, error: fetchError } = await (supabase as SupabaseClient)
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (fetchError) {
    if ((fetchError as { code?: string }).code === 'PGRST116') {
      throw new DealsError('CONTRACT_NOT_FOUND', 'Contract not found or not accessible')
    }
    throw new DealsError('CONTRACT_FETCH_FAILED', (fetchError as { message: string }).message)
  }

  const contract = existing as ContractRow
  const isBrand = contract.brand_id === userId
  const isAthlete = contract.athlete_or_team_id === userId

  if (!isBrand && !isAthlete) {
    throw new DealsError('NOT_PARTICIPANT', 'User is not a participant in this contract')
  }

  if (isBrand && contract.brand_signed_at) {
    throw new DealsError('ALREADY_SIGNED', 'You have already signed this contract')
  }
  if (isAthlete && contract.athlete_signed_at) {
    throw new DealsError('ALREADY_SIGNED', 'You have already signed this contract')
  }

  const now = new Date().toISOString()
  const updates: Record<string, string> = {}

  if (isBrand) {
    updates.brand_signed_at = now
    updates.status = contract.athlete_signed_at ? 'fully_signed' : 'pending_athlete_signature'
  } else {
    updates.athlete_signed_at = now
    updates.status = contract.brand_signed_at ? 'fully_signed' : 'pending_brand_signature'
  }

  const { data: updated, error: updateError } = await (adminSupabase as SupabaseClient)
    .from('contracts')
    .update(updates)
    .eq('id', contractId)
    .select()
    .single()

  if (updateError) {
    throw new DealsError('CONTRACT_SIGN_FAILED', (updateError as { message: string }).message)
  }

  return updated as ContractRow
}

export async function getContract(
  supabase: SupabaseClient<Database>,
  proposalId: string
): Promise<ContractRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('contracts')
    .select('*')
    .eq('proposal_id', proposalId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      return null
    }
    throw new DealsError('CONTRACT_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ContractRow
}
