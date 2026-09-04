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

/**
 * Where a signature came from, for the audit trail spec 11.6 requires.
 *
 * Both values are best-effort and both are personal data: the GDPR erasure
 * routine clears them (20260720003000) while keeping the signature timestamps,
 * which is what makes a retained contract evidentially useful.
 */
export interface SignerContext {
  /** Requester IP, from the leftmost x-forwarded-for entry. */
  ip?: string | null
  /** Raw user-agent string of the signing device. */
  device?: string | null
}

/** Longest device string we keep. Real user agents are well under this. */
const MAX_DEVICE_LENGTH = 512

function normaliseSigner(signer: SignerContext | undefined): {
  ip: string | null
  device: string | null
} {
  const ip = signer?.ip?.trim()
  const device = signer?.device?.trim()
  return {
    // 'unknown' is what clientIpFrom returns when no header is present; an audit
    // trail should say "not captured" rather than record a placeholder as fact.
    ip: ip && ip !== 'unknown' ? ip : null,
    device: device ? device.slice(0, MAX_DEVICE_LENGTH) : null,
  }
}

/**
 * Add the caller's signature to a contract.
 *
 * QA-1.6: this used to write only the signature timestamp and the next status.
 * Two things were missing, both of them legal rather than cosmetic:
 *
 *   * `locked_at` was never set, so a contract reached 'fully_signed' while
 *     still unlocked, and the DB trigger that computes
 *     `retain_until = locked_at + 7 years` (20260419000005) never fired. With
 *     retain_until null, the GDPR erasure logic cannot evaluate how long a
 *     signed contract must be kept, and the spec's "once both parties have
 *     signed: contract locked, immutable" was never actually true of any
 *     contract.
 *
 *   * no signer IP or device was captured, though the columns exist and spec
 *     11.6 requires them per signature event. Only the timestamp half existed.
 */
export async function signContract(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  contractId: string,
  userId: string,
  signer?: SignerContext
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
  const { ip, device } = normaliseSigner(signer)

  // WS-DEAL-03: this used to read the OTHER party's signature in TypeScript and
  // then write an unguarded UPDATE. Two people signing within the same second
  // both read the other as unsigned, so the row ended with BOTH signatures but
  // status stuck on `pending_*` and `locked_at`/`retain_until` never set — a
  // permanent inconsistent state no UI could repair.
  //
  // The fix is two conditional statements, each atomic:
  //
  //   1. CLAIM: write my signature guarded by `my_signed_at IS NULL`. Exactly
  //      one writer per side can win, so a double-click of the same party can
  //      never double-write; a 0-row result means someone already signed for me
  //      (ALREADY_SIGNED). The RETURNING row reflects the committed state at the
  //      moment of the write, so it shows the other party's signature if it has
  //      landed.
  //
  //   2. COMPLETE: if the claimed row now shows BOTH signatures but is not yet
  //      `fully_signed`, flip it (guarded by `status <> 'fully_signed'` so only
  //      one flip wins) and set `locked_at`. Whichever party COMMITS its claim
  //      last runs this step seeing both signatures, so the pair always ends
  //      `fully_signed` and locked, regardless of interleaving.
  const guardColumn = isBrand ? 'brand_signed_at' : 'athlete_signed_at'
  const claim: Record<string, string | null> = isBrand
    ? {
        brand_signed_at: now,
        brand_signer_ip: ip,
        brand_signer_device: device,
        status: 'pending_athlete_signature',
      }
    : {
        athlete_signed_at: now,
        athlete_signer_ip: ip,
        athlete_signer_device: device,
        status: 'pending_brand_signature',
      }

  const { data: claimed, error: claimError } = await (adminSupabase as SupabaseClient)
    .from('contracts')
    .update(claim)
    .eq('id', contractId)
    .is(guardColumn, null)
    .select()
    .single()

  if (claimError) {
    // 0 rows: the guard column was already set, i.e. this side signed between
    // our read and our write (a concurrent double-submit). It is signed either
    // way, so report it as such rather than a generic failure.
    if ((claimError as { code?: string }).code === 'PGRST116') {
      throw new DealsError('ALREADY_SIGNED', 'You have already signed this contract')
    }
    throw new DealsError('CONTRACT_SIGN_FAILED', (claimError as { message: string }).message)
  }

  const claimedRow = claimed as ContractRow

  const bothSigned = !!claimedRow.brand_signed_at && !!claimedRow.athlete_signed_at
  if (bothSigned && claimedRow.status !== 'fully_signed') {
    // Setting locked_at is also what fires contracts_set_retain_until, which
    // computes the 7-year retention date the GDPR erasure logic reads.
    const { data: completed, error: completeError } = await (adminSupabase as SupabaseClient)
      .from('contracts')
      .update({ status: 'fully_signed', locked_at: now })
      .eq('id', contractId)
      .neq('status', 'fully_signed')
      .select()
      .single()

    if (completeError) {
      // Another concurrent writer completed it first (0 rows). The contract is
      // fully signed; return the row we have with the terminal status applied.
      if ((completeError as { code?: string }).code === 'PGRST116') {
        return { ...claimedRow, status: 'fully_signed', locked_at: claimedRow.locked_at ?? now }
      }
      throw new DealsError('CONTRACT_SIGN_FAILED', (completeError as { message: string }).message)
    }

    return completed as ContractRow
  }

  return claimedRow
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
