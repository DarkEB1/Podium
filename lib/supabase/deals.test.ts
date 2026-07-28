import { describe, it, expect, vi } from 'vitest'
import {
  sendProposal,
  getProposals,
  getProposalsForUser,
  respondToProposal,
  counterProposal,
  withdrawProposal,
  getContract,
  signContract,
  DealsError,
} from './deals'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockClient() {
  const singleQueue: Array<{ data: unknown; error: unknown }> = []
  const listQueue: Array<{ data: unknown; error: unknown }> = []
  const rpcQueue: Array<{ data: unknown; error: unknown }> = []

  const mockRpc = vi.fn().mockImplementation(() => {
    const r = rpcQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

  const mockSingle = vi.fn().mockImplementation(() => {
    const r = singleQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    maybeSingle: mockSingle,
    then(
      resolve: (v: unknown) => void,
      reject?: ((reason: unknown) => void) | null
    ): Promise<unknown> {
      const r = listQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.neq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom, rpc: mockRpc } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
    mockRpc,
    queueRpc(data: unknown, error: unknown = null) {
      rpcQueue.push({ data, error })
    },
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
    },
    queueList(data: unknown, error: unknown = null) {
      listQueue.push({ data, error })
    },
    setSingle(data: unknown, error: unknown = null) {
      singleQueue.length = 0
      singleQueue.push({ data, error })
    },
    setChainResult(data: unknown, error: unknown = null) {
      listQueue.length = 0
      listQueue.push({ data, error })
    },
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeProposal = {
  id: 'p1',
  match_id: 'm1',
  sender_id: 'brand1',
  parent_proposal_id: null,
  status: 'pending',
  title: 'Summer Campaign',
  deliverables: { posts: 3 },
  pay_amount: 5000,
  pay_currency: 'GBP',
  pay_type: 'flat_fee',
  timeline_start: '2026-06-01',
  timeline_end: '2026-08-31',
  usage_rights: null,
  additional_terms: null,
  responded_at: null,
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
}

const fakeContract = {
  id: 'c1',
  proposal_id: 'p1',
  match_id: 'm1',
  brand_id: 'brand1',
  athlete_or_team_id: 'athlete1',
  agent_id: null,
  status: 'draft',
  document_url: null,
  brand_signed_at: null,
  brand_signer_ip: null,
  brand_signer_device: null,
  athlete_signed_at: null,
  athlete_signer_ip: null,
  athlete_signer_device: null,
  agent_signed_at: null,
  agent_signer_ip: null,
  esignature_provider: null,
  esignature_envelope_id: null,
  locked_at: null,
  terminated_at: null,
  termination_reason: null,
  retain_until: null,
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
}

const fakeProposalInput = {
  title: 'Summer Campaign',
  deliverables: { posts: 3 },
  pay_amount: 5000,
  pay_currency: 'GBP' as const,
  pay_type: 'flat_fee' as Database['public']['Enums']['pay_type'],
  timeline_start: '2026-06-01',
  timeline_end: '2026-08-31',
  usage_rights: null,
  additional_terms: null,
}

// ---------------------------------------------------------------------------
// sendProposal
// ---------------------------------------------------------------------------

describe('sendProposal', () => {
  it('inserts a proposal with match_id, sender_id, and all deal fields', async () => {
    const { client, chain, mockFrom, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)

    await sendProposal(client, 'm1', 'brand1', fakeProposalInput)

    expect(mockFrom).toHaveBeenCalledWith('proposals')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: 'm1',
        sender_id: 'brand1',
        title: 'Summer Campaign',
        pay_amount: 5000,
        pay_type: 'flat_fee',
      })
    )
  })

  it('returns the created proposal row', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)

    const result = await sendProposal(client, 'm1', 'brand1', fakeProposalInput)

    expect(result).toEqual(fakeProposal)
  })

  it('throws PROPOSAL_INSERT_FAILED on DB error', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { message: 'db error' })

    await expect(
      sendProposal(client, 'm1', 'brand1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_INSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// getProposals
// ---------------------------------------------------------------------------

describe('getProposals', () => {
  it('selects proposals for a match ordered by created_at ascending', async () => {
    const { client, mockFrom, chain, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList([fakeProposal])

    await getProposals(client, 'm1')

    expect(mockFrom).toHaveBeenCalledWith('proposals')
    expect(chain.eq).toHaveBeenCalledWith('match_id', 'm1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('returns proposals array', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList([fakeProposal])

    const result = await getProposals(client, 'm1')

    expect(result).toEqual([fakeProposal])
  })

  it('returns empty array when no proposals', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList(null)

    const result = await getProposals(client, 'm1')

    expect(result).toEqual([])
  })

  it('throws MATCH_NOT_FOUND when match does not exist', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(getProposals(client, 'm1')).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    })
  })

  it('throws PROPOSALS_FETCH_FAILED on DB error', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList(null, { message: 'db error' })

    await expect(getProposals(client, 'm1')).rejects.toMatchObject({
      code: 'PROPOSALS_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// respondToProposal — decline
// ---------------------------------------------------------------------------

describe('respondToProposal (decline)', () => {
  it('sets status to declined and records responded_at', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle({ ...fakeProposal, status: 'declined', responded_at: '2026-04-19T01:00:00Z' })

    const result = await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')

    expect(auth.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'declined' })
    )
    expect(result.status).toBe('declined')
  })

  it('throws PROPOSAL_NOT_FOUND when proposal does not exist (PGRST116)', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' })
  })

  it('throws PROPOSAL_NOT_PENDING when proposal is not pending', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle({ ...fakeProposal, status: 'accepted' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' })
  })

  it('throws PROPOSAL_FETCH_FAILED on non-PGRST116 fetch errors', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(null, { code: '42501', message: 'permission denied' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')
    ).rejects.toMatchObject({ code: 'PROPOSAL_FETCH_FAILED' })
  })

  it('throws NOT_RECIPIENT when caller is the sender', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'brand1', 'declined')
    ).rejects.toMatchObject({ code: 'NOT_RECIPIENT' })
  })

  it('throws PROPOSAL_UPDATE_FAILED on DB error during update', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle(null, { message: 'db error' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')
    ).rejects.toMatchObject({ code: 'PROPOSAL_UPDATE_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// respondToProposal — accept
// ---------------------------------------------------------------------------

// SB-8/DI-2: accepting is now a single `accept_proposal` RPC — the proposal
// update AND the contract insert (with the terms snapshot) happen in ONE
// transaction inside Postgres, so there is nothing left for the admin client
// to do on this path.
describe('respondToProposal (accept)', () => {
  const acceptedRow = {
    ...fakeProposal,
    status: 'accepted',
    responded_at: '2026-04-19T01:00:00Z',
  }

  it('calls the accept_proposal RPC with the proposal id', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(acceptedRow)

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(auth.mockRpc).toHaveBeenCalledWith('accept_proposal', { p_proposal_id: 'p1' })
  })

  it('returns the accepted proposal row', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(acceptedRow)

    const result = await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(result.status).toBe('accepted')
    expect(result.responded_at).toBe('2026-04-19T01:00:00Z')
  })

  it('never touches the admin client (the RPC does not need service role)', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(acceptedRow)

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(admin.mockFrom).not.toHaveBeenCalled()
    expect(admin.mockRpc).not.toHaveBeenCalled()
  })

  it('does not issue a separate contract insert', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(acceptedRow)

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(auth.mockFrom).not.toHaveBeenCalledWith('contracts')
  })

  it('maps PD004 to NOT_RECIPIENT (sender accepting their own proposal)', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(null, { code: 'PD004', message: 'Sender cannot respond to their own proposal' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'brand1', 'accepted')
    ).rejects.toMatchObject({ code: 'NOT_RECIPIENT' })
  })

  it('maps PD003 to PROPOSAL_NOT_PENDING', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(null, { code: 'PD003', message: 'Proposal is not in pending status' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' })
  })

  it('maps PD002 to PROPOSAL_NOT_FOUND', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(null, { code: 'PD002', message: 'Proposal not found' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' })
  })

  it('maps PD005 to NOT_PARTICIPANT', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(null, { code: 'PD005', message: 'Not a participant in this match' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'stranger', 'accepted')
    ).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' })
  })

  it('falls back to PROPOSAL_ACCEPT_FAILED for unmapped DB errors', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueRpc(null, { code: '42501', message: 'permission denied' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')
    ).rejects.toMatchObject({ code: 'PROPOSAL_ACCEPT_FAILED' })
  })

  it('does not insert a contract when declining', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle({ ...fakeProposal, status: 'declined' })

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')

    expect(admin.mockFrom).not.toHaveBeenCalled()
    expect(auth.mockRpc).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// counterProposal
// ---------------------------------------------------------------------------

// SB-7: countering is now a single `counter_proposal` RPC so the parent can
// never be left 'countered' without its child.
describe('counterProposal', () => {
  const counterRow = {
    ...fakeProposal,
    id: 'p2',
    parent_proposal_id: 'p1',
    sender_id: 'athlete1',
  }

  it('calls the counter_proposal RPC with the parent id and full payload', async () => {
    const { client, mockRpc, queueRpc } = makeMockClient()
    queueRpc(counterRow)

    await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(mockRpc).toHaveBeenCalledWith('counter_proposal', {
      p_parent_proposal_id: 'p1',
      p_title: fakeProposalInput.title,
      p_pay_amount: fakeProposalInput.pay_amount,
      p_pay_type: fakeProposalInput.pay_type,
      p_deliverables: fakeProposalInput.deliverables,
      p_pay_currency: fakeProposalInput.pay_currency,
      p_timeline_start: fakeProposalInput.timeline_start,
      p_timeline_end: fakeProposalInput.timeline_end,
      p_usage_rights: null,
      p_additional_terms: null,
    })
  })

  it('never issues a separate parent update / counter insert', async () => {
    const { client, mockFrom, queueRpc } = makeMockClient()
    queueRpc(counterRow)

    await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('defaults an omitted currency and deliverables', async () => {
    const { client, mockRpc, queueRpc } = makeMockClient()
    queueRpc(counterRow)

    await counterProposal(client, 'p1', 'athlete1', {
      title: 'Bare minimum',
      pay_amount: 100,
      pay_type: 'flat_fee' as Database['public']['Enums']['pay_type'],
    })

    expect(mockRpc).toHaveBeenCalledWith(
      'counter_proposal',
      expect.objectContaining({ p_pay_currency: 'GBP', p_deliverables: {} })
    )
  })

  it('returns the new counter-proposal row', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(counterRow)

    const result = await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(result).toEqual(counterRow)
  })

  it('maps PD002 to PROPOSAL_NOT_FOUND', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { code: 'PD002', message: 'Proposal not found' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' })
  })

  it('maps PD003 to PROPOSAL_NOT_PENDING', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { code: 'PD003', message: 'Proposal is not in pending status' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' })
  })

  it('maps PD004 to NOT_RECIPIENT when the caller is the parent sender', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { code: 'PD004', message: 'Sender cannot counter their own proposal' })

    await expect(
      counterProposal(client, 'p1', 'brand1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'NOT_RECIPIENT' })
  })

  it('falls back to COUNTER_INSERT_FAILED for unmapped DB errors', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { code: '42501', message: 'permission denied' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'COUNTER_INSERT_FAILED' })
  })
})

// ---------------------------------------------------------------------------
// withdrawProposal
// ---------------------------------------------------------------------------

describe('withdrawProposal', () => {
  it('sets status to withdrawn for the sender on a pending proposal', async () => {
    const { client, chain, queueSingle } = makeMockClient()
    queueSingle({ ...fakeProposal, status: 'withdrawn' })

    await withdrawProposal(client, 'p1', 'brand1')

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'withdrawn' })
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'p1')
    expect(chain.eq).toHaveBeenCalledWith('sender_id', 'brand1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('throws PROPOSAL_NOT_FOUND when PGRST116 returned', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(withdrawProposal(client, 'p1', 'brand1')).rejects.toMatchObject({
      code: 'PROPOSAL_NOT_FOUND',
    })
  })

  it('throws PROPOSAL_WITHDRAW_FAILED on other DB errors', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: '42501', message: 'permission denied' })

    await expect(withdrawProposal(client, 'p1', 'brand1')).rejects.toMatchObject({
      code: 'PROPOSAL_WITHDRAW_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getContract
// ---------------------------------------------------------------------------

describe('getContract', () => {
  it('selects contract by proposal_id', async () => {
    const { client, chain, mockFrom, queueSingle } = makeMockClient()
    queueSingle(fakeContract)

    await getContract(client, 'p1')

    expect(mockFrom).toHaveBeenCalledWith('contracts')
    expect(chain.eq).toHaveBeenCalledWith('proposal_id', 'p1')
  })

  it('returns the contract row', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeContract)

    const result = await getContract(client, 'p1')

    expect(result).toEqual(fakeContract)
  })

  it('returns null when no contract exists (PGRST116)', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    const result = await getContract(client, 'p1')

    expect(result).toBeNull()
  })

  it('throws CONTRACT_FETCH_FAILED on other DB errors', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: '42501', message: 'permission denied' })

    await expect(getContract(client, 'p1')).rejects.toMatchObject({
      code: 'CONTRACT_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getProposalsForUser
// ---------------------------------------------------------------------------

describe('getProposalsForUser', () => {
  it('returns all proposals visible to the user ordered by created_at descending', async () => {
    const { client, chain, mockFrom, queueList } = makeMockClient()
    queueList([fakeProposal])

    const result = await getProposalsForUser(client, 'brand1')

    expect(mockFrom).toHaveBeenCalledWith('proposals')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([fakeProposal])
  })

  it('returns empty array when user has no proposals', async () => {
    const { client, queueList } = makeMockClient()
    queueList(null)

    const result = await getProposalsForUser(client, 'brand1')

    expect(result).toEqual([])
  })

  it('throws PROPOSALS_FETCH_FAILED on DB error', async () => {
    const { client, queueList } = makeMockClient()
    queueList(null, { message: 'db error' })

    await expect(getProposalsForUser(client, 'brand1')).rejects.toMatchObject({
      code: 'PROPOSALS_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// signContract
// ---------------------------------------------------------------------------

describe('signContract', () => {
  it('records brand_signed_at and sets status to pending_athlete_signature when brand signs first', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)                         // fetch contract
    admin.queueSingle({ ...fakeContract, brand_signed_at: '2026-06-01T00:00:00Z', status: 'pending_athlete_signature' }) // update

    const result = await signContract(auth.client, admin.client, 'c1', 'brand1')

    expect(admin.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_athlete_signature' })
    )
    expect(result.brand_signed_at).toBeTruthy()
  })

  it('records athlete_signed_at and sets status to pending_brand_signature when athlete signs first', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)
    admin.queueSingle({ ...fakeContract, athlete_signed_at: '2026-06-01T00:00:00Z', status: 'pending_brand_signature' })

    const result = await signContract(auth.client, admin.client, 'c1', 'athlete1')

    expect(admin.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_brand_signature' })
    )
    expect(result.athlete_signed_at).toBeTruthy()
  })

  it('sets status to fully_signed when athlete signs and brand already signed', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle({ ...fakeContract, brand_signed_at: '2026-06-01T00:00:00Z' })
    admin.queueSingle({ ...fakeContract, brand_signed_at: '2026-06-01T00:00:00Z', athlete_signed_at: '2026-06-02T00:00:00Z', status: 'fully_signed' })

    const result = await signContract(auth.client, admin.client, 'c1', 'athlete1')

    expect(admin.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fully_signed' })
    )
    expect(result.status).toBe('fully_signed')
  })

  it('throws CONTRACT_NOT_FOUND when contract does not exist', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(signContract(auth.client, admin.client, 'c1', 'brand1')).rejects.toMatchObject({
      code: 'CONTRACT_NOT_FOUND',
    })
  })

  it('throws NOT_PARTICIPANT when user is neither brand nor athlete', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)

    await expect(signContract(auth.client, admin.client, 'c1', 'stranger')).rejects.toMatchObject({
      code: 'NOT_PARTICIPANT',
    })
  })

  it('throws ALREADY_SIGNED when brand tries to sign twice', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle({ ...fakeContract, brand_signed_at: '2026-06-01T00:00:00Z' })

    await expect(signContract(auth.client, admin.client, 'c1', 'brand1')).rejects.toMatchObject({
      code: 'ALREADY_SIGNED',
    })
  })

  it('throws CONTRACT_SIGN_FAILED on DB error during update', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)
    admin.queueSingle(null, { message: 'db error' })

    await expect(signContract(auth.client, admin.client, 'c1', 'brand1')).rejects.toMatchObject({
      code: 'CONTRACT_SIGN_FAILED',
    })
  })

  // 2.3 — under-18 guardian-consent gate on the athlete's signature.
  it('blocks an under-18 athlete without guardian consent and does not write', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract) // fetch contract
    auth.queueSingle({ is_under_18: true, guardian_accepted_at: null }) // guard read

    await expect(signContract(auth.client, admin.client, 'c1', 'athlete1')).rejects.toMatchObject({
      code: 'GUARDIAN_CONSENT_REQUIRED',
    })
    expect(admin.chain.update).not.toHaveBeenCalled()
  })

  it('lets an under-18 athlete sign once a guardian has consented', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)
    auth.queueSingle({ is_under_18: true, guardian_accepted_at: '2026-01-01T00:00:00Z' })
    admin.queueSingle({ ...fakeContract, athlete_signed_at: '2026-06-01T00:00:00Z', status: 'pending_brand_signature' })

    const result = await signContract(auth.client, admin.client, 'c1', 'athlete1')
    expect(result.athlete_signed_at).toBeTruthy()
  })

  it('does not gate an adult athlete', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeContract)
    auth.queueSingle({ is_under_18: false, guardian_accepted_at: null })
    admin.queueSingle({ ...fakeContract, athlete_signed_at: '2026-06-01T00:00:00Z', status: 'pending_brand_signature' })

    const result = await signContract(auth.client, admin.client, 'c1', 'athlete1')
    expect(result.athlete_signed_at).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// DealsError
// ---------------------------------------------------------------------------

describe('DealsError', () => {
  it('is an instance of Error with a code property', () => {
    const err = new DealsError('TEST_CODE', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.name).toBe('DealsError')
  })
})
