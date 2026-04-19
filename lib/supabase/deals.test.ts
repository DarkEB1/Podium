import { describe, it, expect, vi } from 'vitest'
import {
  sendProposal,
  getProposals,
  respondToProposal,
  counterProposal,
  withdrawProposal,
  getContract,
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
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
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

const fakeMatch = {
  id: 'm1',
  user_a_id: 'brand1',
  user_b_id: 'athlete1',
  status: 'active',
  proposal_required: true,
  proposal_sent: true,
  matched_at: '2026-04-19T00:00:00Z',
  connection_request_id: null,
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

describe('respondToProposal (accept)', () => {
  it('sets status to accepted and records responded_at', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)                                      // fetch proposal
    auth.queueSingle({ ...fakeProposal, status: 'accepted', responded_at: '2026-04-19T01:00:00Z' }) // update proposal
    auth.queueSingle(fakeMatch)                                         // fetch match for contract
    admin.queueSingle(fakeContract)                                     // insert contract

    const result = await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(result.status).toBe('accepted')
  })

  it('creates a contract using the admin client when accepting', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle({ ...fakeProposal, status: 'accepted', responded_at: '2026-04-19T01:00:00Z' })
    auth.queueSingle(fakeMatch)
    admin.queueSingle(fakeContract)

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')

    expect(admin.mockFrom).toHaveBeenCalledWith('contracts')
    expect(admin.chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal_id: 'p1',
        match_id: 'm1',
        brand_id: 'brand1',
        athlete_or_team_id: 'athlete1',
      })
    )
  })

  it('throws CONTRACT_CREATE_FAILED when contract insert fails', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle({ ...fakeProposal, status: 'accepted' })
    auth.queueSingle(fakeMatch)
    admin.queueSingle(null, { message: 'contract insert failed' })

    await expect(
      respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'accepted')
    ).rejects.toMatchObject({ code: 'CONTRACT_CREATE_FAILED' })
  })

  it('does not insert a contract when declining', async () => {
    const auth = makeMockClient()
    const admin = makeMockClient()
    auth.queueSingle(fakeProposal)
    auth.queueSingle({ ...fakeProposal, status: 'declined' })

    await respondToProposal(auth.client, admin.client, 'p1', 'athlete1', 'declined')

    expect(admin.mockFrom).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// counterProposal
// ---------------------------------------------------------------------------

describe('counterProposal', () => {
  it('marks the parent proposal as countered', async () => {
    const { client, chain, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)                            // fetch parent proposal
    queueSingle({ ...fakeProposal, status: 'countered' }) // update parent
    queueSingle({ ...fakeProposal, id: 'p2', parent_proposal_id: 'p1', sender_id: 'athlete1' }) // insert counter

    await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'countered' })
    )
  })

  it('inserts a new proposal with parent_proposal_id set', async () => {
    const { client, chain, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)
    queueSingle({ ...fakeProposal, status: 'countered' })
    queueSingle({ ...fakeProposal, id: 'p2', parent_proposal_id: 'p1', sender_id: 'athlete1' })

    await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_proposal_id: 'p1',
        sender_id: 'athlete1',
        match_id: 'm1',
      })
    )
  })

  it('returns the new counter-proposal row', async () => {
    const { client, queueSingle } = makeMockClient()
    const counterRow = { ...fakeProposal, id: 'p2', parent_proposal_id: 'p1', sender_id: 'athlete1' }
    queueSingle(fakeProposal)
    queueSingle({ ...fakeProposal, status: 'countered' })
    queueSingle(counterRow)

    const result = await counterProposal(client, 'p1', 'athlete1', fakeProposalInput)

    expect(result).toEqual(counterRow)
  })

  it('throws PROPOSAL_NOT_FOUND when proposal does not exist', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' })
  })

  it('throws PROPOSAL_NOT_PENDING when proposal is not pending', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle({ ...fakeProposal, status: 'accepted' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' })
  })

  it('throws NOT_RECIPIENT when caller is the sender', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)

    await expect(
      counterProposal(client, 'p1', 'brand1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'NOT_RECIPIENT' })
  })

  it('throws COUNTER_INSERT_FAILED when counter proposal insert fails', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)
    queueSingle({ ...fakeProposal, status: 'countered' })
    queueSingle(null, { message: 'insert failed' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'COUNTER_INSERT_FAILED' })
  })

  it('throws PROPOSAL_UPDATE_FAILED when parent status update fails', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeProposal)
    queueSingle(null, { code: '42501', message: 'permission denied' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_UPDATE_FAILED' })
  })

  it('throws PROPOSAL_FETCH_FAILED on non-PGRST116 fetch errors', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: '42501', message: 'permission denied' })

    await expect(
      counterProposal(client, 'p1', 'athlete1', fakeProposalInput)
    ).rejects.toMatchObject({ code: 'PROPOSAL_FETCH_FAILED' })
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
