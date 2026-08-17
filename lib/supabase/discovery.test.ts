import { describe, it, expect, vi } from 'vitest'
import { CONNECTION_MESSAGE_MIN, CONNECTION_MESSAGE_MAX } from '@/lib/limits'
import {
  createListing,
  updateListing,
  publishListing,
  getListings,
  getActiveListingsPage,
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
  listingDeadlineCutoff,
  isListingOpenForApplications,
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
  // Queued results take precedence, for the flows that make two .single() round
  // trips (e.g. the listing guard, then the connection_requests insert).
  const singleQueue: Array<{ data: unknown; error: unknown }> = []

  const mockSingle = vi
    .fn()
    .mockImplementation(() => Promise.resolve(singleQueue.shift() ?? singleResult))

  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    range: vi.fn(),
    order: vi.fn(),
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
  chain.or.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.range.mockImplementation(() => Promise.resolve(chainResult))

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    mockSingle,
    setSingle(data: unknown, error: unknown = null) {
      singleQueue.length = 0
      singleResult = { data, error }
    },
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
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

  // A blank optional field arrives as '' from the listing form. Postgres rejects
  // '' for a timestamptz (22007) and fails the whole insert, so empty strings are
  // dropped here exactly as sanitizeProfileData drops them.
  it('drops empty-string values before inserting', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1', brand_id: 'bp1', title: 'Test' })

    await createListing(client, 'bp1', {
      title: 'Test',
      application_deadline: '',
      description: '',
      pay_currency: 'GBP',
    })

    const insertArg = chain.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(insertArg).not.toHaveProperty('application_deadline')
    expect(insertArg).not.toHaveProperty('description')
    expect(insertArg['pay_currency']).toBe('GBP')
  })

  it('keeps a null value, which is how a deadline is cleared', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1', brand_id: 'bp1', title: 'Test' })

    await createListing(client, 'bp1', { title: 'Test', application_deadline: null })

    const insertArg = chain.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(insertArg['application_deadline']).toBeNull()
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

  it('drops empty-string values before updating', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'l1', title: 'Updated' })

    await updateListing(client, 'l1', 'bp1', { title: 'Updated', application_deadline: '' })

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, unknown>
    expect(updateArg['title']).toBe('Updated')
    expect(updateArg).not.toHaveProperty('application_deadline')
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

    // PR-19: every listing is flattened to carry the owning brand's *user* id,
    // which is what connection requests must address. Absent embed -> null.
    expect(result).toEqual([
      {
        id: 'l1',
        title: 'Listing 1',
        brand_user_id: null,
        brand_name: null,
        brand_logo_url: null,
        brand_cover_url: null,
        brand_description: null,
      },
    ])
  })

  it('flattens the embedded brand profile to brand_user_id / brand_name', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult([
      {
        id: 'l1',
        title: 'Listing 1',
        brand_id: 'bp1',
        brand_profiles: { user_id: 'u-brand', company_name: 'Acme Ltd', trading_name: 'Acme' },
      },
    ])

    const result = await getListings(client)

    expect(result[0]).toMatchObject({
      id: 'l1',
      brand_id: 'bp1',
      brand_user_id: 'u-brand',
      brand_name: 'Acme',
    })
    // the raw embed must not leak through to consumers
    expect(result[0]).not.toHaveProperty('brand_profiles')
  })

  it('falls back to company_name and tolerates an array-shaped embed', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult([
      {
        id: 'l2',
        brand_profiles: [{ user_id: 'u-brand-2', company_name: 'Beta Ltd', trading_name: null }],
      },
    ])

    const result = await getListings(client)

    expect(result[0]).toMatchObject({ brand_user_id: 'u-brand-2', brand_name: 'Beta Ltd' })
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
  // PR-8: the personalised message is bounded at BOTH ends. Fixtures must use a
  // realistic message — 'Hello' is below CONNECTION_MESSAGE_MIN and would now be
  // rejected before any DB call, masking the behaviour under test.
  const VALID = 'a'.repeat(CONNECTION_MESSAGE_MIN)

  it('inserts into connection_requests with sender, recipient, and message', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'cr1', sender_id: 'u1', recipient_id: 'u2', message: VALID })

    await sendConnectionRequest(client, 'u1', 'u2', VALID)

    expect(mockFrom).toHaveBeenCalledWith('connection_requests')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'u1', recipient_id: 'u2', message: VALID })
    )
  })

  it('returns the created request row', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeRequest = { id: 'cr1', sender_id: 'u1', recipient_id: 'u2' }
    setSingle(fakeRequest)

    const result = await sendConnectionRequest(client, 'u1', 'u2', VALID)

    expect(result).toEqual(fakeRequest)
  })

  it('throws MESSAGE_TOO_LONG when message exceeds the maximum', async () => {
    const { client } = makeMockClient()
    const longMessage = 'a'.repeat(CONNECTION_MESSAGE_MAX + 1)

    await expect(sendConnectionRequest(client, 'u1', 'u2', longMessage)).rejects.toMatchObject({
      code: 'MESSAGE_TOO_LONG',
    })
  })

  it('allows a message of exactly the maximum length', async () => {
    const { client, setSingle } = makeMockClient()
    const exactMessage = 'a'.repeat(CONNECTION_MESSAGE_MAX)
    setSingle({ id: 'cr1', sender_id: 'u1', recipient_id: 'u2', message: exactMessage })

    await expect(sendConnectionRequest(client, 'u1', 'u2', exactMessage)).resolves.toBeDefined()
  })

  // PR-8 regression guard: the composer used to require >= 300 characters while
  // this rejected > 300, so only an exactly-300-character message could be sent
  // and the whole connection flow was unusable (PR-19). Min must stay < max.
  it('has a minimum strictly below the maximum', () => {
    expect(CONNECTION_MESSAGE_MIN).toBeLessThan(CONNECTION_MESSAGE_MAX)
  })

  it('throws MESSAGE_TOO_SHORT below the minimum', async () => {
    const { client } = makeMockClient()

    await expect(sendConnectionRequest(client, 'u1', 'u2', 'Hello')).rejects.toMatchObject({
      code: 'MESSAGE_TOO_SHORT',
    })
  })

  it('rejects a request addressed to the sender themselves', async () => {
    const { client } = makeMockClient()

    await expect(sendConnectionRequest(client, 'u1', 'u1', VALID)).rejects.toMatchObject({
      code: 'SELF_CONNECT',
    })
  })

  it('throws DUPLICATE_REQUEST on unique constraint violation (23505)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23505', message: 'duplicate key' })

    await expect(sendConnectionRequest(client, 'u1', 'u2', VALID)).rejects.toMatchObject({
      code: 'DUPLICATE_REQUEST',
    })
  })

  it('throws REQUEST_CREATE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(sendConnectionRequest(client, 'u1', 'u2', VALID)).rejects.toMatchObject({
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

// ---------------------------------------------------------------------------
// getActiveListingsPage (FA-5 / SB-9)
// ---------------------------------------------------------------------------

function makeListingPagingClient(rows: unknown[]) {
  const calls: {
    select?: string
    eq?: unknown[]
    or?: string
    order?: unknown[]
    range?: [number, number]
  } = {}
  const chain: Record<string, unknown> = {}
  const self = () => chain

  chain['select'] = vi.fn((cols: string) => {
    calls.select = cols
    return self()
  })
  chain['eq'] = vi.fn((...args: unknown[]) => {
    calls.eq = args
    return self()
  })
  chain['or'] = vi.fn((predicate: string) => {
    calls.or = predicate
    return self()
  })
  chain['order'] = vi.fn((...args: unknown[]) => {
    calls.order = args
    return self()
  })
  chain['range'] = vi.fn((from: number, to: number) => {
    calls.range = [from, to]
    return Promise.resolve({ data: rows, error: null })
  })

  return {
    client: { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>,
    calls,
  }
}

describe('getActiveListingsPage', () => {
  it('filters to active listings in SQL, not in JavaScript', async () => {
    const { client, calls } = makeListingPagingClient([])
    await getActiveListingsPage(client)
    expect(calls.eq).toEqual(['status', 'active'])
    expect(calls.order?.[0]).toBe('created_at')
  })

  // -- L-6 / DI-3: application deadlines -----------------------------------

  it('excludes expired listings in SQL, not in JavaScript', async () => {
    const { client, calls } = makeListingPagingClient([])

    await getActiveListingsPage(client, { now: new Date('2026-07-20T09:30:00.000Z') })

    // Cutoff is the start of the current UTC day, so a listing whose deadline
    // IS today is still included — see listingDeadlineCutoff.
    expect(calls.or).toBe(
      'application_deadline.is.null,application_deadline.gte.2026-07-20T00:00:00.000Z'
    )
  })

  it('keeps listings with no deadline in the feed forever', async () => {
    const { client, calls } = makeListingPagingClient([])
    await getActiveListingsPage(client)
    expect(calls.or).toMatch(/application_deadline\.is\.null/)
  })

  it('projects columns instead of selecting everything', async () => {
    const { client, calls } = makeListingPagingClient([])
    await getActiveListingsPage(client)
    expect(calls.select).not.toMatch(/^\*/)
    expect(calls.select).toMatch(/title/)
    expect(calls.select).toMatch(/brand_profiles!inner/)
  })

  it('fetches limit + 1 rows and reports hasMore without returning the extra row', async () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}` }))
    const { client, calls } = makeListingPagingClient(rows)

    const page = await getActiveListingsPage(client, { limit: 3 })

    expect(calls.range).toEqual([0, 3])
    expect(page.listings).toHaveLength(3)
    expect(page.hasMore).toBe(true)
  })

  it('reports hasMore false on a short page and offsets later pages', async () => {
    const { client, calls } = makeListingPagingClient([{ id: 'l0' }])
    const page = await getActiveListingsPage(client, { limit: 5, offset: 10 })
    expect(calls.range).toEqual([10, 15])
    expect(page.hasMore).toBe(false)
  })

  it('flattens the embedded brand profile to brand_user_id / brand_name', async () => {
    const { client } = makeListingPagingClient([
      {
        id: 'l1',
        title: 'Listing 1',
        brand_profiles: { user_id: 'u-brand', company_name: 'Acme Ltd', trading_name: 'Acme' },
      },
    ])

    const page = await getActiveListingsPage(client)

    expect(page.listings[0]).toMatchObject({ brand_user_id: 'u-brand', brand_name: 'Acme' })
    expect(page.listings[0]).not.toHaveProperty('brand_profiles')
  })

  it('flattens the embedded brand profile description to brand_description', async () => {
    const { client } = makeListingPagingClient([
      {
        id: 'l1',
        title: 'Listing 1',
        brand_profiles: {
          user_id: 'u-brand',
          company_name: 'Acme Ltd',
          trading_name: 'Acme',
          description: 'Sustainable sportswear brand backing grassroots athletes.',
        },
      },
    ])

    const page = await getActiveListingsPage(client)

    expect(page.listings[0]).toMatchObject({
      brand_description: 'Sustainable sportswear brand backing grassroots athletes.',
    })
    expect(page.listings[0]).not.toHaveProperty('brand_profiles')
  })

  it('throws LISTING_FETCH_FAILED on DB error', async () => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain['select'] = vi.fn(self)
    chain['eq'] = vi.fn(self)
    chain['or'] = vi.fn(self)
    chain['order'] = vi.fn(self)
    chain['range'] = vi.fn(() => Promise.resolve({ data: null, error: { message: 'db error' } }))
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>

    await expect(getActiveListingsPage(client)).rejects.toMatchObject({
      code: 'LISTING_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// Application deadline semantics (L-6 / DI-3)
// ---------------------------------------------------------------------------

describe('listingDeadlineCutoff', () => {
  it('is the start of the current UTC day, so a deadline is inclusive of its own day', () => {
    expect(listingDeadlineCutoff(new Date('2026-07-20T23:59:59.000Z'))).toBe(
      '2026-07-20T00:00:00.000Z'
    )
  })

  it('moves on at midnight UTC, closing the previous day', () => {
    expect(listingDeadlineCutoff(new Date('2026-07-21T00:00:00.000Z'))).toBe(
      '2026-07-21T00:00:00.000Z'
    )
  })
})

describe('isListingOpenForApplications', () => {
  const now = new Date('2026-07-20T12:00:00.000Z')

  it('accepts an active listing with no deadline', () => {
    expect(
      isListingOpenForApplications({ status: 'active', application_deadline: null }, now)
    ).toBe(true)
  })

  it('accepts a listing on the deadline day itself', () => {
    expect(
      isListingOpenForApplications(
        { status: 'active', application_deadline: '2026-07-20T00:00:00+00:00' },
        now
      )
    ).toBe(true)
  })

  it('rejects a listing whose deadline day has passed', () => {
    expect(
      isListingOpenForApplications(
        { status: 'active', application_deadline: '2026-07-19T00:00:00+00:00' },
        now
      )
    ).toBe(false)
  })

  it('rejects a listing that is not active regardless of the deadline', () => {
    expect(
      isListingOpenForApplications({ status: 'draft', application_deadline: null }, now)
    ).toBe(false)
    expect(
      isListingOpenForApplications({ status: 'expired', application_deadline: null }, now)
    ).toBe(false)
  })
})

describe('sendConnectionRequest listing guard (L-6)', () => {
  const NOW = '2026-07-20T12:00:00.000Z'

  function listingClient(listing: unknown) {
    const mock = makeMockClient()
    mock.setSingle(listing)
    return mock
  }

  it('does not look a listing up when the caller does not supply one', async () => {
    const mock = makeMockClient()
    mock.setSingle({ id: 'cr-1' })

    await sendConnectionRequest(mock.client, 'sender', 'recipient', 'x'.repeat(50))

    expect(mock.mockFrom).toHaveBeenCalledWith('connection_requests')
    expect(mock.mockFrom).not.toHaveBeenCalledWith('job_listings')
  })

  it('rejects an application to a listing whose deadline has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    const mock = listingClient({
      id: 'listing-1',
      status: 'active',
      application_deadline: '2026-06-01T00:00:00+00:00',
    })

    await expect(
      sendConnectionRequest(mock.client, 'sender', 'recipient', 'x'.repeat(50), 'listing-1')
    ).rejects.toMatchObject({ name: 'DiscoveryError', code: 'LISTING_CLOSED' })

    expect(mock.chain.insert).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('rejects an application to a listing that is no longer active', async () => {
    const mock = listingClient({
      id: 'listing-1',
      status: 'expired',
      application_deadline: null,
    })

    await expect(
      sendConnectionRequest(mock.client, 'sender', 'recipient', 'x'.repeat(50), 'listing-1')
    ).rejects.toMatchObject({ code: 'LISTING_CLOSED' })
  })

  it('rejects an application to a listing that does not exist', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116', message: 'not found' })

    await expect(
      sendConnectionRequest(mock.client, 'sender', 'recipient', 'x'.repeat(50), 'listing-1')
    ).rejects.toMatchObject({ code: 'LISTING_NOT_FOUND' })
  })

  it('allows an application to an open listing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    const mock = makeMockClient()
    mock.queueSingle({
      id: 'listing-1',
      status: 'active',
      application_deadline: '2026-07-20T00:00:00+00:00',
    })
    mock.queueSingle({ id: 'cr-1' })

    const row = await sendConnectionRequest(
      mock.client,
      'sender',
      'recipient',
      'x'.repeat(50),
      'listing-1'
    )

    expect(row).toMatchObject({ id: 'cr-1' })
    vi.useRealTimers()
  })
})
