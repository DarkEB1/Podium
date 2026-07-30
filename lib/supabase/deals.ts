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

/**
 * Custom SQLSTATEs raised by the SECURITY DEFINER deal functions
 * (supabase/migrations/20260720001003_deal_transactions.sql), mapped back to
 * the `DealsError` codes the API routes already branch on.
 */
const RPC_ERROR_CODES: Record<string, string> = {
  PD001: 'UNAUTHENTICATED',
  PD002: 'PROPOSAL_NOT_FOUND',
  PD003: 'PROPOSAL_NOT_PENDING',
  PD004: 'NOT_RECIPIENT',
  PD005: 'NOT_PARTICIPANT',
  PD006: 'MATCH_NOT_FOUND',
  // SEC-1 (20260720005000): an UPDATE tried to change an immutable proposal
  // column — sender_id, match_id, parent_proposal_id, created_at or any of the
  // economic terms. Only reachable by a client crafting a raw PostgREST PATCH.
  PD007: 'PROPOSAL_IMMUTABLE',
  // SEC-2 (20260720005001): accept_proposal() could not decide which side of
  // the match is the brand, so it refused rather than write an inverted
  // contract (which would also invert the payer/payee on every payment).
  PD008: 'NO_BRAND_PARTICIPANT',
  PD009: 'AMBIGUOUS_BRAND_PARTICIPANTS',
  PD010: 'COUNTERPARTY_NOT_ATHLETE_OR_TEAM',
  // SEC-6 (20260720005003): caller is not the data subject, an admin or the
  // service role.
  PD011: 'NOT_AUTHORISED',
  // SEC-8 (20260720005005): an UPDATE tried to change a match's participants.
  PD012: 'MATCH_PARTICIPANTS_IMMUTABLE',
}

function throwRpcError(error: unknown, fallbackCode: string): never {
  // as { code?: string; message?: string }: PostgrestError is structurally this;
  // the generic-stripped client returns it as `unknown`.
  const e = error as { code?: string; message?: string }
  const mapped = e.code ? RPC_ERROR_CODES[e.code] : undefined
  throw new DealsError(mapped ?? fallbackCode, e.message ?? 'Unknown database error')
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

/**
 * Send a proposal, which is also what opens the match's free-text chat.
 *
 * QA-1.4: this used to be a bare insert into `proposals`, and nothing anywhere
 * ever set `matches.proposal_sent`. Since both the messages RLS policy and
 * `sendMessage` refuse free text until that flag is true, no match in the
 * product could ever hold an ordinary conversation. The insert and the gate
 * release now happen inside the `send_proposal` SECURITY DEFINER function
 * (20260730000200), i.e. one transaction, for the same reason accept/counter
 * were moved there: a stored proposal with the gate still shut is a match that
 * can never chat, and retrying would duplicate the proposal.
 *
 * `senderId` is no longer sent to the DB (the function uses `auth.uid()`); it is
 * kept in the signature for call-site compatibility.
 */
export async function sendProposal(
  supabase: SupabaseClient<Database>,
  matchId: string,
  senderId: string,
  payload: ProposalPayload
): Promise<ProposalRow> {
  // as SupabaseClient: strips the Database generic — send_proposal is not in the
  // generated Functions map, which would otherwise reject the rpc name.
  const { data, error } = await (supabase as SupabaseClient).rpc('send_proposal', {
    p_match_id: matchId,
    p_title: payload.title,
    p_pay_amount: payload.pay_amount,
    p_pay_type: payload.pay_type,
    p_deliverables: payload.deliverables ?? {},
    p_pay_currency: payload.pay_currency ?? 'GBP',
    p_timeline_start: payload.timeline_start ?? null,
    p_timeline_end: payload.timeline_end ?? null,
    p_usage_rights: payload.usage_rights ?? null,
    p_additional_terms: payload.additional_terms ?? null,
  })

  if (error) {
    throwRpcError(error, 'PROPOSAL_INSERT_FAILED')
  }

  if (!data) {
    throw new DealsError('MATCH_NOT_FOUND', 'Match not found or not accessible')
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

/**
 * Respond to a proposal.
 *
 * ACCEPT is delegated to the `accept_proposal` SECURITY DEFINER function
 * (SB-8/DI-2): it verifies the caller is a match participant and is not the
 * proposal's sender, flips the status, and inserts the contract — snapshotting
 * the economic terms — inside ONE transaction. The old two-step
 * (update proposal, then admin-client contract insert) could leave an accepted
 * proposal with no contract if the process died in between.
 *
 * DECLINE stays a plain RLS-guarded update; it touches nothing else.
 *
 * `adminSupabase` is retained for signature compatibility with existing
 * callers and is no longer used — the RPC needs no service-role client.
 */
export async function respondToProposal(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  proposalId: string,
  responderId: string,
  action: 'accepted' | 'declined'
): Promise<ProposalRow> {
  if (action === 'accepted') {
    // as SupabaseClient: strips the Database generic — accept_proposal is not in
    // the generated Functions map, which would otherwise reject the rpc name.
    const { data, error } = await (supabase as SupabaseClient).rpc('accept_proposal', {
      p_proposal_id: proposalId,
    })

    if (error) {
      throwRpcError(error, 'PROPOSAL_ACCEPT_FAILED')
    }

    if (!data) {
      throw new DealsError('PROPOSAL_NOT_FOUND', 'Proposal not found or not accessible')
    }

    return data as ProposalRow
  }

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

  return updated as ProposalRow
}

/**
 * Counter a pending proposal.
 *
 * SB-7: marking the parent 'countered' and inserting the counter used to be two
 * separate round-trips, so a failure between them orphaned the parent in a
 * 'countered' state with no child. Both statements now run inside the
 * `counter_proposal` SECURITY DEFINER function, i.e. one transaction.
 *
 * `senderId` is no longer sent to the DB (the function uses `auth.uid()`); it is
 * kept in the signature for call-site compatibility.
 */
export async function counterProposal(
  supabase: SupabaseClient<Database>,
  parentProposalId: string,
  senderId: string,
  payload: ProposalPayload
): Promise<ProposalRow> {
  // as SupabaseClient: strips the Database generic — counter_proposal is not in
  // the generated Functions map, which would otherwise reject the rpc name.
  const { data, error } = await (supabase as SupabaseClient).rpc('counter_proposal', {
    p_parent_proposal_id: parentProposalId,
    p_title: payload.title,
    p_pay_amount: payload.pay_amount,
    p_pay_type: payload.pay_type,
    p_deliverables: payload.deliverables ?? {},
    p_pay_currency: payload.pay_currency ?? 'GBP',
    p_timeline_start: payload.timeline_start ?? null,
    p_timeline_end: payload.timeline_end ?? null,
    p_usage_rights: payload.usage_rights ?? null,
    p_additional_terms: payload.additional_terms ?? null,
  })

  if (error) {
    throwRpcError(error, 'COUNTER_INSERT_FAILED')
  }

  if (!data) {
    throw new DealsError('PROPOSAL_NOT_FOUND', 'Proposal not found or not accessible')
  }

  return data as ProposalRow
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

  // 2.3 — an under-18 athlete cannot add their signature until a guardian has
  // consented. The DB trigger (contracts_enforce_guardian_consent) enforces this
  // unconditionally, even on this service-role write path; this check exists to
  // return a clean, mappable error before the round-trip. A team signer has no
  // athlete_profiles row and is unaffected.
  if (isAthlete) {
    const { data: ap, error: apError } = await (supabase as SupabaseClient)
      .from('athlete_profiles')
      .select('is_under_18, guardian_accepted_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (apError) {
      throw new DealsError('CONTRACT_FETCH_FAILED', (apError as { message: string }).message)
    }
    const profile = ap as { is_under_18: boolean; guardian_accepted_at: string | null } | null
    if (profile && profile.is_under_18 && !profile.guardian_accepted_at) {
      throw new DealsError(
        'GUARDIAN_CONSENT_REQUIRED',
        'A parent or guardian must consent before you can sign this contract'
      )
    }
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

/**
 * A single proposal by id, or null if it is not found or not visible to the
 * caller under RLS. Used by the deal detail pages so they never issue a raw
 * Supabase query outside lib/supabase/ (the athlete page's original inline
 * select predated this helper).
 */
export async function getProposalById(
  supabase: SupabaseClient<Database>,
  proposalId: string
): Promise<ProposalRow | null> {
  // as SupabaseClient: strips the Database generic to avoid deep chain inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new DealsError('PROPOSAL_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ProposalRow
}
