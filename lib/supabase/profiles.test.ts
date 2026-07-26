import { describe, it, expect, vi } from 'vitest'
import {
  createProfile,
  getOwnProfile,
  updateProfile,
  publishProfile,
  getPublicProfile,
  createRepresentationLink,
  respondRepresentationLink,
  getRepresentationLinks,
  getActiveAthleteProfiles,
  getActiveAthleteProfilesPage,
  getDiscoveryUiMode,
  updateDiscoveryUiMode,
  ATHLETE_PAGE_SIZE,
  ProfileError,
} from './profiles'
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
// createProfile
// ---------------------------------------------------------------------------

describe('createProfile', () => {
  it('inserts into athlete_profiles when role is athlete', async () => {
    const { client, mockFrom, setSingle } = makeMockClient()
    const fakeProfile = { id: 'p1', user_id: 'u1', status: 'draft' }
    setSingle(fakeProfile)

    const result = await createProfile(client, 'u1', 'athlete', { display_name: 'Test' })

    expect(mockFrom).toHaveBeenCalledWith('athlete_profiles')
    expect(result).toEqual(fakeProfile)
  })

  it('inserts into brand_profiles when role is brand', async () => {
    const { client, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'p2', user_id: 'u2', status: 'pending_approval' })

    await createProfile(client, 'u2', 'brand', {
      company_name: 'Acme',
      linkedin_url: 'https://linkedin.com/c/acme',
    })

    expect(mockFrom).toHaveBeenCalledWith('brand_profiles')
  })

  it('passes user_id and provided data to insert', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'p1', user_id: 'u1' })

    await createProfile(client, 'u1', 'athlete', { display_name: 'Alice', primary_sport: 'Tennis' })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', display_name: 'Alice', primary_sport: 'Tennis' })
    )
  })

  it('throws PROFILE_ALREADY_EXISTS on unique constraint violation', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23505', message: 'duplicate key value' })

    await expect(createProfile(client, 'u1', 'athlete', {})).rejects.toMatchObject({
      code: 'PROFILE_ALREADY_EXISTS',
    })
  })

  it('throws PROFILE_CREATE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'syntax error' })

    await expect(createProfile(client, 'u1', 'athlete', {})).rejects.toMatchObject({
      code: 'PROFILE_CREATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getOwnProfile
// ---------------------------------------------------------------------------

describe('getOwnProfile', () => {
  it('returns profile row when found', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeProfile = { id: 'p1', user_id: 'u1', status: 'draft' }
    setSingle(fakeProfile)

    const result = await getOwnProfile(client, 'u1', 'athlete')

    expect(result).toEqual(fakeProfile)
  })

  it('returns null when profile does not exist (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows returned' })

    const result = await getOwnProfile(client, 'u1', 'athlete')

    expect(result).toBeNull()
  })

  it.each([
    ['athlete', 'athlete_profiles'],
    ['team', 'team_profiles'],
    ['brand', 'brand_profiles'],
    ['agent', 'agent_profiles'],
  ] as const)('queries %s for %s role', async (role, table) => {
    const { client, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'p1', user_id: 'u1' })

    await getOwnProfile(client, 'u1', role)

    expect(mockFrom).toHaveBeenCalledWith(table)
  })
})

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
  it('calls update on the correct table with provided data', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    const updated = { id: 'p1', user_id: 'u1', display_name: 'Updated' }
    setSingle(updated)

    const result = await updateProfile(client, 'u1', 'athlete', { display_name: 'Updated' })

    expect(mockFrom).toHaveBeenCalledWith('athlete_profiles')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Updated' })
    )
    expect(result).toEqual(updated)
  })

  it('throws PROFILE_NOT_FOUND when no profile exists (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(updateProfile(client, 'u1', 'athlete', {})).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    })
  })

  it('throws PROFILE_UPDATE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42000', message: 'db error' })

    await expect(updateProfile(client, 'u1', 'athlete', {})).rejects.toMatchObject({
      code: 'PROFILE_UPDATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// publishProfile
// ---------------------------------------------------------------------------

describe('publishProfile', () => {
  it.each(['athlete', 'team', 'agent'] as const)(
    'sets status to active for %s',
    async (role) => {
      const { client, chain } = makeMockClient()

      await publishProfile(client, 'u1', role)

      expect(chain.update).toHaveBeenCalledWith({ status: 'active' })
    }
  )

  it('queries the correct table for each role', async () => {
    const { client, mockFrom } = makeMockClient()

    await publishProfile(client, 'u1', 'team')

    expect(mockFrom).toHaveBeenCalledWith('team_profiles')
  })

  it('throws BRAND_NOT_PUBLISHABLE for brand role', async () => {
    const { client } = makeMockClient()

    await expect(publishProfile(client, 'u1', 'brand')).rejects.toMatchObject({
      code: 'BRAND_NOT_PUBLISHABLE',
    })
  })

  it('throws PROFILE_NOT_FOUND when no profile exists (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(publishProfile(client, 'u1', 'athlete')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    })
  })

  it('throws PROFILE_PUBLISH_FAILED when DB returns a non-PGRST116 error', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(publishProfile(client, 'u1', 'athlete')).rejects.toMatchObject({
      code: 'PROFILE_PUBLISH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getPublicProfile
// ---------------------------------------------------------------------------

describe('getPublicProfile', () => {
  it('returns profile row when found (RLS ensures it is active)', async () => {
    const { client, setSingle } = makeMockClient()
    const fakeProfile = { id: 'p1', user_id: 'u1', status: 'active' }
    setSingle(fakeProfile)

    const result = await getPublicProfile(client, 'u1', 'athlete')

    expect(result).toEqual(fakeProfile)
  })

  it('returns null when profile not found (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    const result = await getPublicProfile(client, 'u1', 'athlete')

    expect(result).toBeNull()
  })

  it('queries the correct table for each role', async () => {
    const { client, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'p1', user_id: 'u1', status: 'active' })

    await getPublicProfile(client, 'u1', 'brand')

    expect(mockFrom).toHaveBeenCalledWith('brand_profiles')
  })
})

// ---------------------------------------------------------------------------
// createRepresentationLink
// ---------------------------------------------------------------------------

describe('createRepresentationLink', () => {
  it('inserts into representation_links with correct fields', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    const fakeLink = {
      id: 'link-1',
      agent_id: 'agent-p1',
      client_user_id: 'u2',
      client_role: 'athlete',
    }
    setSingle(fakeLink)

    const result = await createRepresentationLink(client, 'agent-p1', 'u2', 'athlete')

    expect(mockFrom).toHaveBeenCalledWith('representation_links')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: 'agent-p1',
        client_user_id: 'u2',
        client_role: 'athlete',
      })
    )
    expect(result).toEqual(fakeLink)
  })

  it('throws LINK_CREATE_FAILED on DB error', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '23503', message: 'foreign key violation' })

    await expect(
      createRepresentationLink(client, 'agent-p1', 'u2', 'athlete')
    ).rejects.toMatchObject({
      code: 'LINK_CREATE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// respondRepresentationLink
// ---------------------------------------------------------------------------

describe('respondRepresentationLink', () => {
  it('sets status to active and records accepted_at when accepting', async () => {
    const { client, chain } = makeMockClient()

    const before = new Date()
    await respondRepresentationLink(client, 'link-1', 'u2', true)
    const after = new Date()

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, string>
    expect(updateArg['status']).toBe('active')
    const acceptedAt = new Date(updateArg['accepted_at']!)
    expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(acceptedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('sets status to terminated and records terminated_at when declining', async () => {
    const { client, chain } = makeMockClient()

    await respondRepresentationLink(client, 'link-1', 'u2', false)

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, string>
    expect(updateArg['status']).toBe('terminated')
    expect(updateArg['terminated_at']).toBeDefined()
  })

  it('filters by both linkId and clientUserId', async () => {
    const { client, chain } = makeMockClient()

    await respondRepresentationLink(client, 'link-1', 'u2', true)

    expect(chain.eq).toHaveBeenCalledWith('id', 'link-1')
    expect(chain.eq).toHaveBeenCalledWith('client_user_id', 'u2')
  })

  it('throws LINK_NOT_FOUND when link does not exist or user is not the client (PGRST116)', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(respondRepresentationLink(client, 'bad-link', 'u2', true)).rejects.toMatchObject({
      code: 'LINK_NOT_FOUND',
    })
  })
})

// ---------------------------------------------------------------------------
// getRepresentationLinks
// ---------------------------------------------------------------------------

describe('getRepresentationLinks', () => {
  it('returns links array for client user', async () => {
    const { client, mockFrom, setChainResult } = makeMockClient()
    const fakeLinks = [{ id: 'link-1', client_user_id: 'u1', agent_id: 'agent-p1' }]
    setChainResult(fakeLinks)

    const result = await getRepresentationLinks(client, 'u1')

    expect(mockFrom).toHaveBeenCalledWith('representation_links')
    expect(result).toEqual(fakeLinks)
  })

  it('returns empty array when data is null', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null)

    const result = await getRepresentationLinks(client, 'u1')

    expect(result).toEqual([])
  })

  it('throws LINKS_FETCH_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(getRepresentationLinks(client, 'u1')).rejects.toMatchObject({
      code: 'LINKS_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// field sanitization (via createProfile and updateProfile)
// ---------------------------------------------------------------------------

describe('createProfile — field sanitization', () => {
  it('strips protected fields before inserting', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'p1', user_id: 'u1' })

    await createProfile(client, 'u1', 'athlete', {
      display_name: 'Alice',
      status: 'active',
      id: 'hacked-id',
      admin_approved_at: '2026-01-01',
      is_under_18: true,
    })

    const insertArg = chain.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(insertArg['display_name']).toBe('Alice')
    expect(insertArg['status']).toBeUndefined()
    expect(insertArg['id']).toBeUndefined()
    expect(insertArg['admin_approved_at']).toBeUndefined()
    expect(insertArg['is_under_18']).toBeUndefined()
    expect(insertArg['user_id']).toBe('u1')
  })
})

describe('updateProfile — field sanitization', () => {
  it('strips protected fields before updating', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'p1', user_id: 'u1', display_name: 'Updated' })

    await updateProfile(client, 'u1', 'athlete', {
      display_name: 'Updated',
      status: 'active',
      admin_approved_by: 'hacker',
    })

    const updateArg = chain.update.mock.calls[0]![0] as Record<string, unknown>
    expect(updateArg['display_name']).toBe('Updated')
    expect(updateArg['status']).toBeUndefined()
    expect(updateArg['admin_approved_by']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ProfileError
// ---------------------------------------------------------------------------

describe('ProfileError', () => {
  it('is an instance of Error with a code property', () => {
    const err = new ProfileError('TEST_CODE', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.name).toBe('ProfileError')
  })
})

// ---------------------------------------------------------------------------
// Discovery feed pagination + browse mode (FA-5 / SB-9 / PR-23)
// ---------------------------------------------------------------------------

function makePagingClient(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  const calls: { select?: string; range?: [number, number]; order?: unknown; eq?: unknown[] } = {}
  const self = () => chain

  chain['select'] = vi.fn((cols: string) => {
    calls.select = cols
    return self()
  })
  chain['eq'] = vi.fn((...args: unknown[]) => {
    calls.eq = args
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
  chain['then'] = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: rows, error: null }).then(resolve)

  return {
    client: { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>,
    calls,
  }
}

const athleteRow = (id: string) => ({ id, user_id: `u-${id}`, display_name: id })

describe('getActiveAthleteProfilesPage', () => {
  it('requests limit + 1 rows and reports hasMore without returning the extra row', async () => {
    const rows = Array.from({ length: 4 }, (_, i) => athleteRow(`a${i}`))
    const { client, calls } = makePagingClient(rows)

    const page = await getActiveAthleteProfilesPage(client, { limit: 3, offset: 0 })

    expect(calls.range).toEqual([0, 3])
    expect(page.athletes).toHaveLength(3)
    expect(page.hasMore).toBe(true)
  })

  it('reports hasMore false when the page is not full', async () => {
    const { client } = makePagingClient([athleteRow('a0')])
    const page = await getActiveAthleteProfilesPage(client, { limit: 3 })
    expect(page.hasMore).toBe(false)
    expect(page.athletes).toHaveLength(1)
  })

  it('offsets subsequent pages', async () => {
    const { client, calls } = makePagingClient([])
    await getActiveAthleteProfilesPage(client, { limit: 10, offset: 20 })
    expect(calls.range).toEqual([20, 30])
  })

  it('defaults to a bounded page rather than the whole table', async () => {
    const { client, calls } = makePagingClient([])
    await getActiveAthleteProfilesPage(client)
    expect(calls.range).toEqual([0, ATHLETE_PAGE_SIZE])
  })

  // SB-9/FA-4: a public browse feed must not ship guardian contact details,
  // payout fragments or Stripe ids just because select('*') was easier.
  it('projects columns instead of selecting everything', async () => {
    const { client, calls } = makePagingClient([])
    await getActiveAthleteProfilesPage(client)

    expect(calls.select).not.toBe('*')
    expect(calls.select).toMatch(/display_name/)
    expect(calls.select).not.toMatch(/guardian_email|payout_|stripe_connect/)
  })
})

describe('getActiveAthleteProfiles', () => {
  it('no longer selects every column', async () => {
    const { client, calls } = makePagingClient([athleteRow('a0')])
    await getActiveAthleteProfiles(client)
    expect(calls.select).not.toBe('*')
    expect(calls.select).not.toMatch(/guardian_email|payout_|stripe_connect/)
  })
})

describe('discovery ui mode', () => {
  it('reads the persisted mode from the role table', async () => {
    const mock = makeMockClient()
    mock.setSingle({ discovery_ui_mode: 'swipe' })
    const mode = await getDiscoveryUiMode(mock.client, 'user-1', 'athlete')
    expect(mock.mockFrom).toHaveBeenCalledWith('athlete_profiles')
    expect(mode).toBe('swipe')
  })

  it('falls back to marketplace when there is no profile row', async () => {
    const mock = makeMockClient()
    mock.setSingle(null, { code: 'PGRST116' })
    await expect(getDiscoveryUiMode(mock.client, 'user-1', 'brand')).resolves.toBe('marketplace')
  })

  it('writes the mode through the profile update path', async () => {
    const mock = makeMockClient()
    mock.setSingle({ id: 'p1', discovery_ui_mode: 'swipe' })
    await updateDiscoveryUiMode(mock.client, 'user-1', 'team', 'swipe')
    expect(mock.chain.update).toHaveBeenCalledWith({ discovery_ui_mode: 'swipe' })
  })
})
