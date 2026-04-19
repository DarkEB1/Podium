import { describe, it, expect, vi } from 'vitest'
import {
  createListing,
  updateListing,
  publishListing,
  getListings,
  getListing,
  sendConnectionRequest,
  respondConnectionRequest,
  withdrawConnectionRequest,
  addToShortlist,
  removeFromShortlist,
  getShortlist,
  blockUser,
  unblockUser,
  getBlocks,
  DiscoveryError,
} from './discovery'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockClient() {
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
  let chainResult: { data: unknown; error: unknown } = { data: null, error: null }

  const mockSingle = vi.fn().mockImplementation(() => Promise.resolve(singleResult))

  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: mockSingle,
    then(
      resolve: (v: unknown) => void,
      reject?: ((reason: unknown) => void) | null
    ): Promise<unknown> {
      return Promise.resolve(chainResult).then(resolve, reject ?? undefined)
    },
  }

  chain.select.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
    setSingle(data: unknown, error: unknown = null) {
      singleResult = { data, error }
    },
    setChainResult(data: unknown, error: unknown = null) {
      chainResult = { data, error }
    },
  }
}

// ---------------------------------------------------------------------------
// createListing
// ---------------------------------------------------------------------------

describe('createListing', () => {
  it('inserts into job_listings with brand_id and provided data', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'l1', brand_id: 'bp1', title: 'Wanted: Tennis Athlete' })

    await createListing(client, 'bp1', { title: 'Wanted: Tennis Athlete', type: 'athlete_endorsement' })

    expect(mockFrom).toHaveBeenCalledWith('job_listings')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ brand_id: 'bp1', title: 'Wanted: Tennis Athlete' })
    )
  })

  it('returns the created listing row', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeListing = { id: 'l1', brand_id: 'bp1', title: 'Wanted: Tennis Athlete', status: 'draft' }
    setSingle(fakeListing)

    const result = await createListing(client, 'bp1', { title: 'Wanted: Tennis Athlete', type: 'athlete_endorsement' })

    expect(result).toEqual(fakeListing)
  })

  it('throws LISTING_CREATE_FAILED on DB error', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(createListing(client, 'bp1', {})).rejects.toMatchObject({
      code: 'LISTING_CREATE_FAILED',
    })
  })

  it('strips protected fields (status, id, brand_id, timestamps) before inserting', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1', brand_id: 'bp1', title: 'Test' })

    await createListing(client, 'bp1', {
      title: 'Test',
      status: 'active',
      id: 'hacked-id',
      brand_id: 'other-brand',
      created_at: '2000-01-01',
      updated_at: '2000-01-01',
    })

    const insertArg = chain.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(insertArg['title']).toBe('Test')
    expect(insertArg['status']).toBeUndefined()
    expect(insertArg['id']).toBeUndefined()
    expect(insertArg['created_at']).toBeUndefined()
    expect(insertArg['updated_at']).toBeUndefined()
    // brand_id is always set from the parameter, not from user data
    expect(insertArg['brand_id']).toBe('bp1')
  })
})

// ---------------------------------------------------------------------------
// updateListing
// ---------------------------------------------------------------------------

describe('updateListing', () => {
  it('calls update on job_listings with provided data', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'l1', title: 'Updated Title' })

    await updateListing(client, 'l1', 'bp1', { title: 'Updated Title' })

    expect(mockFrom).toHaveBeenCalledWith('job_listings')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Title' }))
  })

  it('filters by listing id and brand_id', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1' })

    await updateListing(client, 'l1', 'bp1', {})

    expect(chain.eq).toHaveBeenCalledWith('id', 'l1')
    expect(chain.eq).toHaveBeenCalledWith('brand_id', 'bp1')
  })

  it('throws LISTING_NOT_FOUND on PGRST116', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(updateListing(client, 'l1', 'bp1', {})).rejects.toMatchObject({
      code: 'LISTING_NOT_FOUND',
    })
  })

  it('throws LISTING_UPDATE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(updateListing(client, 'l1', 'bp1', {})).rejects.toMatchObject({
      code: 'LISTING_UPDATE_FAILED',
    })
  })

  it('strips protected fields before updating', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1', title: 'Updated' })

    await updateListing(client, 'l1', 'bp1', {
      title: 'Updated',
      status: 'active',
      id: 'hacked-id',
      brand_id: 'other-brand',
    })

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, unknown>
    expect(updateArg['title']).toBe('Updated')
    expect(updateArg['status']).toBeUndefined()
    expect(updateArg['id']).toBeUndefined()
    expect(updateArg['brand_id']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// publishListing
// ---------------------------------------------------------------------------

describe('publishListing', () => {
  it('sets status to active', async () => {
    const { client, chain } = makeMockClient()

    await publishListing(client, 'l1', 'bp1')

    expect(chain.update).toHaveBeenCalledWith({ status: 'active' })
  })

  it('filters by listing id, brand_id, and draft status', async () => {
    const { client, chain } = makeMockClient()

    await publishListing(client, 'l1', 'bp1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'l1')
    expect(chain.eq).toHaveBeenCalledWith('brand_id', 'bp1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft')
  })

  it('throws LISTING_NOT_FOUND on PGRST116', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(publishListing(client, 'l1', 'bp1')).rejects.toMatchObject({
      code: 'LISTING_NOT_FOUND',
    })
  })

  it('throws LISTING_PUBLISH_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(publishListing(client, 'l1', 'bp1')).rejects.toMatchObject({
      code: 'LISTING_PUBLISH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getListings
// ---------------------------------------------------------------------------

describe('getListings', () => {
  it('selects from job_listings', async () => {
    const { client, mockFrom, setChainResult } = makeMockClient()
    setChainResult([])

    await getListings(client)

    expect(mockFrom).toHaveBeenCalledWith('job_listings')
  })

  it('returns listings array', async () => {
    const { client, setChainResult } = makeMockClient()
    const fakeListings = [{ id: 'l1', title: 'Listing 1' }]
    setChainResult(fakeListings)

    const result = await getListings(client)

    expect(result).toEqual(fakeListings)
  })

  it('returns empty array when data is null', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null)

    const result = await getListings(client)

    expect(result).toEqual([])
  })

  it('throws LISTING_FETCH_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(getListings(client)).rejects.toMatchObject({
      code: 'LISTING_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getListing
// ---------------------------------------------------------------------------

describe('getListing', () => {
  it('returns listing row when found', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeListing = { id: 'l1', title: 'Listing 1', status: 'active' }
    setSingle(fakeListing)

    const result = await getListing(client, 'l1')

    expect(result).toEqual(fakeListing)
  })

  it('returns null when not found (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    const result = await getListing(client, 'l1')

    expect(result).toBeNull()
  })

  it('filters by listing id', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1' })

    await getListing(client, 'l1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'l1')
  })

  it('throws LISTING_FETCH_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(getListing(client, 'l1')).rejects.toMatchObject({
      code: 'LISTING_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// sendConnectionRequest
// ---------------------------------------------------------------------------

describe('sendConnectionRequest', () => {
  it('inserts into connection_requests with sender, recipient, and message', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'cr1', sender_id: 'u1', recipient_id: 'u2', message: 'Hello' })

    await sendConnectionRequest(client, 'u1', 'u2', 'Hello')

    expect(mockFrom).toHaveBeenCalledWith('connection_requests')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'u1', recipient_id: 'u2', message: 'Hello' })
    )
  })

  it('returns the created request row', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeRequest = { id: 'cr1', sender_id: 'u1', recipient_id: 'u2' }
    setSingle(fakeRequest)

    const result = await sendConnectionRequest(client, 'u1', 'u2', 'Hello')

    expect(result).toEqual(fakeRequest)
  })

  it('throws MESSAGE_TOO_LONG when message exceeds 300 characters', async () => {
    const { client } = makeMockClient()
    const longMessage = 'a'.repeat(301)

    await expect(sendConnectionRequest(client, 'u1', 'u2', longMessage)).rejects.toMatchObject({
      code: 'MESSAGE_TOO_LONG',
    })
  })

  it('allows message of exactly 300 characters', async () => {
    const { client, setSingle } = makeMockClient()
    const exactMessage = 'a'.repeat(300)
    setSingle({ id: 'cr1', sender_id: 'u1', recipient_id: 'u2', message: exactMessage })

    await expect(sendConnectionRequest(client, 'u1', 'u2', exactMessage)).resolves.toBeDefined()
  })

  it('throws DUPLICATE_REQUEST on unique constraint violation (23505)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23505', message: 'duplicate key' })

    await expect(sendConnectionRequest(client, 'u1', 'u2', 'Hello')).rejects.toMatchObject({
      code: 'DUPLICATE_REQUEST',
    })
  })

  it('throws REQUEST_CREATE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(sendConnectionRequest(client, 'u1', 'u2', 'Hello')).rejects.toMatchObject({
      code: 'REQUEST_CREATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// respondConnectionRequest
// ---------------------------------------------------------------------------

describe('respondConnectionRequest', () => {
  it('sets status to accepted and records responded_at when accepting', async () => {
    const { client, chain } = makeMockClient()

    const before = new Date()
    await respondConnectionRequest(client, 'cr1', 'u2', true)
    const after = new Date()

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, string>
    expect(updateArg['status']).toBe('accepted')
    const respondedAt = new Date(updateArg['responded_at']!)
    expect(respondedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(respondedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('sets status to declined and records responded_at when declining', async () => {
    const { client, chain } = makeMockClient()

    await respondConnectionRequest(client, 'cr1', 'u2', false)

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, string>
    expect(updateArg['status']).toBe('declined')
    expect(updateArg['responded_at']).toBeDefined()
  })

  it('filters by request id and recipient id', async () => {
    const { client, chain } = makeMockClient()

    await respondConnectionRequest(client, 'cr1', 'u2', true)

    expect(chain.eq).toHaveBeenCalledWith('id', 'cr1')
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'u2')
  })

  it('throws REQUEST_NOT_FOUND on PGRST116', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(respondConnectionRequest(client, 'cr1', 'u2', true)).rejects.toMatchObject({
      code: 'REQUEST_NOT_FOUND',
    })
  })

  it('throws REQUEST_RESPOND_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(respondConnectionRequest(client, 'cr1', 'u2', true)).rejects.toMatchObject({
      code: 'REQUEST_RESPOND_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// withdrawConnectionRequest
// ---------------------------------------------------------------------------

describe('withdrawConnectionRequest', () => {
  it('sets status to withdrawn', async () => {
    const { client, chain } = makeMockClient()

    await withdrawConnectionRequest(client, 'cr1', 'u1')

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, string>
    expect(updateArg['status']).toBe('withdrawn')
  })

  it('filters by request id, sender id, and pending status', async () => {
    const { client, chain } = makeMockClient()

    await withdrawConnectionRequest(client, 'cr1', 'u1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'cr1')
    expect(chain.eq).toHaveBeenCalledWith('sender_id', 'u1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('throws REQUEST_NOT_FOUND on PGRST116', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(withdrawConnectionRequest(client, 'cr1', 'u1')).rejects.toMatchObject({
      code: 'REQUEST_NOT_FOUND',
    })
  })

  it('throws REQUEST_WITHDRAW_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(withdrawConnectionRequest(client, 'cr1', 'u1')).rejects.toMatchObject({
      code: 'REQUEST_WITHDRAW_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// addToShortlist
// ---------------------------------------------------------------------------

describe('addToShortlist', () => {
  it('inserts into shortlists with user_id and target_user_id', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 's1', user_id: 'u1', target_user_id: 'u2' })

    await addToShortlist(client, 'u1', 'u2')

    expect(mockFrom).toHaveBeenCalledWith('shortlists')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', target_user_id: 'u2' })
    )
  })

  it('returns the created shortlist row', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeShortlist = { id: 's1', user_id: 'u1', target_user_id: 'u2' }
    setSingle(fakeShortlist)

    const result = await addToShortlist(client, 'u1', 'u2')

    expect(result).toEqual(fakeShortlist)
  })

  it('throws ALREADY_SHORTLISTED on unique constraint violation (23505)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23505', message: 'duplicate key' })

    await expect(addToShortlist(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'ALREADY_SHORTLISTED',
    })
  })

  it('throws SHORTLIST_ADD_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(addToShortlist(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'SHORTLIST_ADD_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// removeFromShortlist
// ---------------------------------------------------------------------------

describe('removeFromShortlist', () => {
  it('deletes from shortlists filtering by user_id and target_user_id', async () => {
    const { client, chain, mockFrom, setChainResult } = makeMockClient()
    setChainResult(null)

    await removeFromShortlist(client, 'u1', 'u2')

    expect(mockFrom).toHaveBeenCalledWith('shortlists')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(chain.eq).toHaveBeenCalledWith('target_user_id', 'u2')
  })

  it('throws SHORTLIST_REMOVE_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(removeFromShortlist(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'SHORTLIST_REMOVE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getShortlist
// ---------------------------------------------------------------------------

describe('getShortlist', () => {
  it('returns shortlist array for user', async () => {
    const { client, mockFrom, setChainResult } = makeMockClient()
    const fakeShortlist = [{ id: 's1', user_id: 'u1', target_user_id: 'u2' }]
    setChainResult(fakeShortlist)

    const result = await getShortlist(client, 'u1')

    expect(mockFrom).toHaveBeenCalledWith('shortlists')
    expect(result).toEqual(fakeShortlist)
  })

  it('returns empty array when data is null', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null)

    const result = await getShortlist(client, 'u1')

    expect(result).toEqual([])
  })

  it('filters by user_id', async () => {
    const { client, chain, setChainResult } = makeMockClient()
    setChainResult([])

    await getShortlist(client, 'u1')

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('throws SHORTLIST_FETCH_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(getShortlist(client, 'u1')).rejects.toMatchObject({
      code: 'SHORTLIST_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// blockUser
// ---------------------------------------------------------------------------

describe('blockUser', () => {
  it('inserts into blocks with blocker_id and blocked_id', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'b1', blocker_id: 'u1', blocked_id: 'u2' })

    await blockUser(client, 'u1', 'u2')

    expect(mockFrom).toHaveBeenCalledWith('blocks')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ blocker_id: 'u1', blocked_id: 'u2' })
    )
  })

  it('returns the created block row', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeBlock = { id: 'b1', blocker_id: 'u1', blocked_id: 'u2' }
    setSingle(fakeBlock)

    const result = await blockUser(client, 'u1', 'u2')

    expect(result).toEqual(fakeBlock)
  })

  it('throws ALREADY_BLOCKED on unique constraint violation (23505)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23505', message: 'duplicate key' })

    await expect(blockUser(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'ALREADY_BLOCKED',
    })
  })

  it('throws BLOCK_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(blockUser(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'BLOCK_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// unblockUser
// ---------------------------------------------------------------------------

describe('unblockUser', () => {
  it('deletes from blocks filtering by blocker_id and blocked_id', async () => {
    const { client, chain, mockFrom, setChainResult } = makeMockClient()
    setChainResult(null)

    await unblockUser(client, 'u1', 'u2')

    expect(mockFrom).toHaveBeenCalledWith('blocks')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('blocker_id', 'u1')
    expect(chain.eq).toHaveBeenCalledWith('blocked_id', 'u2')
  })

  it('throws UNBLOCK_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(unblockUser(client, 'u1', 'u2')).rejects.toMatchObject({
      code: 'UNBLOCK_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getBlocks
// ---------------------------------------------------------------------------

describe('getBlocks', () => {
  it('returns blocks array for blocker', async () => {
    const { client, mockFrom, setChainResult } = makeMockClient()
    const fakeBlocks = [{ id: 'b1', blocker_id: 'u1', blocked_id: 'u2' }]
    setChainResult(fakeBlocks)

    const result = await getBlocks(client, 'u1')

    expect(mockFrom).toHaveBeenCalledWith('blocks')
    expect(result).toEqual(fakeBlocks)
  })

  it('returns empty array when data is null', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null)

    const result = await getBlocks(client, 'u1')

    expect(result).toEqual([])
  })

  it('filters by blocker_id', async () => {
    const { client, chain, setChainResult } = makeMockClient()
    setChainResult([])

    await getBlocks(client, 'u1')

    expect(chain.eq).toHaveBeenCalledWith('blocker_id', 'u1')
  })

  it('throws BLOCKS_FETCH_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(getBlocks(client, 'u1')).rejects.toMatchObject({
      code: 'BLOCKS_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// DiscoveryError
// ---------------------------------------------------------------------------

describe('DiscoveryError', () => {
  it('is an instance of Error with a code property', () => {
    const err = new DiscoveryError('TEST_CODE', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.name).toBe('DiscoveryError')
  })
})
