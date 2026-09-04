import { describe, it, expect, vi } from 'vitest'
import {
  createTeamProfile,
  updateTeamProfile,
  getTeamProfile,
  listTeamAdmins,
  inviteTeamAdmin,
  updateTeamAdmin,
  resendTeamAdminInvite,
  removeTeamAdmin,
  TeamError,
} from './teams'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
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
  chain.upsert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    chain,
    mockFrom,
    queueSingle(data: unknown, error: unknown = null) {
      singleQueue.push({ data, error })
    },
    queueList(data: unknown, error: unknown = null) {
      listQueue.push({ data, error })
    },
  }
}

describe('createTeamProfile', () => {
  it('injects user_id and strips protected/empty fields', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', user_id: 'user-1', team_name: 'Falcons' })
    await createTeamProfile(m.client, 'user-1', {
      team_name: 'Falcons',
      nickname: '',
      id: 'spoof',
      status: 'published',
      // cast via unknown: deliberately omits user_id (injected by the fn) and
      // includes spoofed protected fields to assert they are stripped
    } as unknown as Database['public']['Tables']['team_profiles']['Insert'])
    const insert = m.chain.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insert).toEqual({ team_name: 'Falcons', user_id: 'user-1', status: 'active' })
  })

  it('creates the profile active, not draft', async () => {
    // Team onboarding is a single form with no separate publish step, so the
    // profile must be usable the moment it exists. Left at the column default
    // ('draft') the middleware treats the account as mid-onboarding forever and
    // the team can never reach its dashboard or settings.
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', user_id: 'user-1', status: 'active' })
    await createTeamProfile(m.client, 'user-1', {
      team_name: 'Falcons',
    } as Database['public']['Tables']['team_profiles']['Insert'])
    const insert = m.chain.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insert.status).toBe('active')
  })

  it('ignores a caller-supplied status and still activates', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', user_id: 'user-1', status: 'active' })
    await createTeamProfile(m.client, 'user-1', {
      team_name: 'Falcons',
      status: 'suspended',
    } as unknown as Database['public']['Tables']['team_profiles']['Insert'])
    const insert = m.chain.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insert.status).toBe('active')
  })

  it('throws TeamError on failure', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'boom' })
    await expect(
      createTeamProfile(m.client, 'user-1', {
        user_id: 'user-1',
      } as Database['public']['Tables']['team_profiles']['Insert'])
    ).rejects.toBeInstanceOf(TeamError)
  })
})

describe('updateTeamProfile', () => {
  it('updates the row scoped by user_id and strips protected fields', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', user_id: 'user-1', fan_reach: 'national' })
    await updateTeamProfile(m.client, 'user-1', {
      fan_reach: 'national',
      status: 'suspended',
      id: 'spoof',
    })
    expect(m.mockFrom).toHaveBeenCalledWith('team_profiles')
    expect(m.chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    const update = m.chain.update.mock.calls[0]?.[0] as Record<string, unknown>
    expect(update.fan_reach).toBe('national')
    expect('status' in update).toBe(false)
    expect('id' in update).toBe(false)
  })

  it('clears an optional field via empty string (PM-15)', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', user_id: 'user-1' })
    await updateTeamProfile(m.client, 'user-1', { home_city: '' })
    const update = m.chain.update.mock.calls[0]?.[0] as Record<string, unknown>
    expect('home_city' in update).toBe(true)
    expect(update.home_city).toBeNull()
  })

  it('throws TEAM_PROFILE_NOT_FOUND on PGRST116', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { code: 'PGRST116', message: 'no rows' })
    await expect(updateTeamProfile(m.client, 'user-1', { fan_reach: 'local' }))
      .rejects.toMatchObject({ code: 'TEAM_PROFILE_NOT_FOUND' })
  })
})

describe('updateTeamAdmin', () => {
  it('updates the admin role by id', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'a1', role: 'view_only' })
    await updateTeamAdmin(m.client, 'a1', { role: 'view_only' })
    expect(m.mockFrom).toHaveBeenCalledWith('team_admins')
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'a1')
    const update = m.chain.update.mock.calls[0]?.[0] as Record<string, unknown>
    expect(update.role).toBe('view_only')
  })

  it('throws on failure', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'denied' })
    await expect(updateTeamAdmin(m.client, 'a1', { role: 'standard' }))
      .rejects.toBeInstanceOf(TeamError)
  })
})

describe('resendTeamAdminInvite', () => {
  it('upserts on (team_id, invited_email) instead of a colliding insert', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'a1', team_id: 'team-1', invited_email: 'x@y.com', invite_status: 'invited' })
    await resendTeamAdminInvite(m.client, 'team-1', 'inviter-1', {
      email: 'x@y.com',
      role: 'standard',
    })
    expect(m.chain.upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = m.chain.upsert.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(payload.team_id).toBe('team-1')
    expect(payload.invited_email).toBe('x@y.com')
    expect(payload.invite_status).toBe('invited')
    expect(opts.onConflict).toBe('team_id,invited_email')
    // Must NOT use a plain insert (the bug: it violated the unique index).
    expect(m.chain.insert).not.toHaveBeenCalled()
  })

  it('throws TEAM_ADMIN_RESEND_FAILED on error rather than swallowing it', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'boom' })
    await expect(
      resendTeamAdminInvite(m.client, 'team-1', 'inviter-1', { email: 'x@y.com' })
    ).rejects.toMatchObject({ code: 'TEAM_ADMIN_RESEND_FAILED' })
  })
})

describe('getTeamProfile', () => {
  it('returns the profile by id', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'team-1', team_name: 'Falcons' })
    const result = await getTeamProfile(m.client, 'team-1')
    expect(result?.id).toBe('team-1')
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'team-1')
  })

  it('returns null on PGRST116', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { code: 'PGRST116', message: 'no rows' })
    expect(await getTeamProfile(m.client, 'missing')).toBeNull()
  })
})

describe('listTeamAdmins', () => {
  it('lists admins for the team', async () => {
    const m = makeMockClient()
    m.queueList([{ id: 'a1', team_id: 'team-1' }])
    const result = await listTeamAdmins(m.client, 'team-1')
    expect(result).toHaveLength(1)
    expect(m.mockFrom).toHaveBeenCalledWith('team_admins')
    expect(m.chain.eq).toHaveBeenCalledWith('team_id', 'team-1')
  })
})

describe('inviteTeamAdmin', () => {
  it('inserts an invite with default standard role', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'a1', team_id: 'team-1', invited_email: 'x@y.com', role: 'standard' })
    await inviteTeamAdmin(m.client, 'team-1', 'inviter-1', { email: 'x@y.com' })
    expect(m.chain.insert).toHaveBeenCalledWith({
      team_id: 'team-1',
      invited_by: 'inviter-1',
      invited_email: 'x@y.com',
      role: 'standard',
      full_name: null,
    })
  })

  it('honours explicit role and name', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'a1' })
    await inviteTeamAdmin(m.client, 'team-1', 'inviter-1', {
      email: 'z@y.com',
      role: 'view_only',
      fullName: 'Zoe',
    })
    const insert = m.chain.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insert.role).toBe('view_only')
    expect(insert.full_name).toBe('Zoe')
  })
})

describe('removeTeamAdmin', () => {
  it('deletes by admin id', async () => {
    const m = makeMockClient()
    m.queueList(null)
    await removeTeamAdmin(m.client, 'a1')
    expect(m.chain.delete).toHaveBeenCalled()
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'a1')
  })

  it('throws on failure', async () => {
    const m = makeMockClient()
    m.queueList(null, { message: 'denied' })
    await expect(removeTeamAdmin(m.client, 'a1')).rejects.toBeInstanceOf(TeamError)
  })
})
