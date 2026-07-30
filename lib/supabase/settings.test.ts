import { describe, it, expect, vi } from 'vitest'
import {
  getSettings,
  updateSettings,
  getActiveSessions,
  revokeSession,
  getLoginHistory,
  requestDataExport,
  SettingsError,
} from './settings'
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
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
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

const SETTINGS = {
  id: 'set-1',
  user_id: 'user-1',
  discoverable: true,
  display_currency: 'gbp',
  email_digest: 'weekly',
  location_precision: 'city',
  marketing_opt_in: false,
  notification_matrix: {},
  pause_matches: false,
  profile_visible: true,
  quiet_hours_end: null,
  quiet_hours_start: null,
  section_visibility: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('getSettings', () => {
  it('returns settings for the user', async () => {
    const m = makeMockClient()
    m.queueSingle(SETTINGS)
    const result = await getSettings(m.client, 'user-1')
    expect(result.user_id).toBe('user-1')
    expect(m.mockFrom).toHaveBeenCalledWith('profile_settings')
    expect(m.chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws SettingsError on db error', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'boom' })
    await expect(getSettings(m.client, 'user-1')).rejects.toBeInstanceOf(SettingsError)
  })

  it('returns defaults when the user has no settings row yet', async () => {
    // QA-1.5: this used to throw, and since every transactional email checks
    // preferences through here, one missing row meant no email of any kind ever
    // sent. A preference read is not the place to fail.
    const m = makeMockClient()
    m.queueSingle(null)
    const result = await getSettings(m.client, 'user-1')
    expect(result.user_id).toBe('user-1')
    expect(result.email_digest).toBe('off')
    expect(result.marketing_opt_in).toBe(false)
    expect(result.notification_matrix).toEqual({})
  })

  it('does not present the defaults as a stored row', async () => {
    const m = makeMockClient()
    m.queueSingle(null)
    const result = await getSettings(m.client, 'user-1')
    expect(result.id).toBe('')
    expect(result.created_at).toBeNull()
  })
})

describe('updateSettings', () => {
  it('strips protected fields before update', async () => {
    const m = makeMockClient()
    m.queueSingle({ ...SETTINGS, pause_matches: true })
    await updateSettings(m.client, 'user-1', {
      pause_matches: true,
      // protected fields that must be dropped
      id: 'hacked',
      user_id: 'other',
    } as Database['public']['Tables']['profile_settings']['Update'])
    const patch = m.chain.update.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch).toEqual({ pause_matches: true })
    expect(m.chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('maps PGRST116 to SETTINGS_NOT_FOUND', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { code: 'PGRST116', message: 'no rows' })
    await expect(
      updateSettings(m.client, 'user-1', { pause_matches: true })
    ).rejects.toMatchObject({ code: 'SETTINGS_NOT_FOUND' })
  })
})

describe('getActiveSessions', () => {
  it('returns ordered sessions', async () => {
    const m = makeMockClient()
    m.queueList([{ id: 's1', user_id: 'user-1' }])
    const result = await getActiveSessions(m.client, 'user-1')
    expect(result).toHaveLength(1)
    expect(m.mockFrom).toHaveBeenCalledWith('active_sessions')
    expect(m.chain.order).toHaveBeenCalledWith('last_active_at', { ascending: false })
  })
})

describe('revokeSession', () => {
  it('deletes by session id only (RLS scopes user)', async () => {
    const m = makeMockClient()
    m.queueList(null)
    await revokeSession(m.client, 'sess-9')
    expect(m.chain.delete).toHaveBeenCalled()
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'sess-9')
  })

  it('throws on delete error', async () => {
    const m = makeMockClient()
    m.queueList(null, { message: 'denied' })
    await expect(revokeSession(m.client, 'sess-9')).rejects.toBeInstanceOf(SettingsError)
  })
})

describe('getLoginHistory', () => {
  it('returns history newest first', async () => {
    const m = makeMockClient()
    m.queueList([{ id: 'l1', user_id: 'user-1', success: true }])
    const result = await getLoginHistory(m.client, 'user-1')
    expect(result).toHaveLength(1)
    expect(m.mockFrom).toHaveBeenCalledWith('login_history')
    expect(m.chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('requestDataExport', () => {
  it('inserts a pending export request for the user', async () => {
    const m = makeMockClient()
    m.queueSingle({ id: 'exp-1', user_id: 'user-1', status: 'pending' })
    const result = await requestDataExport(m.client, 'user-1')
    expect(result.status).toBe('pending')
    expect(m.chain.insert).toHaveBeenCalledWith({ user_id: 'user-1' })
  })

  it('throws on insert failure', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'fail' })
    await expect(requestDataExport(m.client, 'user-1')).rejects.toMatchObject({
      code: 'DATA_EXPORT_REQUEST_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// Cookie consent + notification preferences (M-7 / CL-2 / CL-4)
// ---------------------------------------------------------------------------

import {
  getCookiePrefs,
  updateCookiePrefs,
  saveCookiePrefsForCurrentUser,
  getNotificationMatrix,
  updateNotificationMatrix,
  unsubscribeFromAllEmail,
} from './settings'
import { acceptAllPreferences } from '@/lib/legal/cookie-consent'

describe('getCookiePrefs', () => {
  it('returns the parsed preferences stored on users.cookie_prefs', async () => {
    const m = makeMockClient()
    const prefs = acceptAllPreferences()
    m.queueSingle({ cookie_prefs: prefs })

    expect(await getCookiePrefs(m.client, 'user-1')).toEqual(prefs)
    expect(m.mockFrom).toHaveBeenCalledWith('users')
  })

  it('returns null (never a default) when nothing is stored', async () => {
    const m = makeMockClient()
    m.queueSingle({ cookie_prefs: null })
    expect(await getCookiePrefs(m.client, 'user-1')).toBeNull()
  })

  it('returns null for a malformed record rather than assuming consent', async () => {
    const m = makeMockClient()
    m.queueSingle({ cookie_prefs: { analytics: 'yes' } })
    expect(await getCookiePrefs(m.client, 'user-1')).toBeNull()
  })

  it('throws SettingsError on a query failure', async () => {
    const m = makeMockClient()
    m.queueSingle(null, { message: 'boom' })
    await expect(getCookiePrefs(m.client, 'user-1')).rejects.toBeInstanceOf(SettingsError)
  })
})

describe('updateCookiePrefs', () => {
  it('writes the choice to users.cookie_prefs', async () => {
    const m = makeMockClient()
    const prefs = acceptAllPreferences()
    m.queueList(null)

    expect(await updateCookiePrefs(m.client, 'user-1', prefs)).toEqual(prefs)
    expect(m.mockFrom).toHaveBeenCalledWith('users')
    expect(m.chain.update).toHaveBeenCalledWith({ cookie_prefs: prefs })
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'user-1')
  })
})

describe('saveCookiePrefsForCurrentUser', () => {
  it('returns false for a signed-out visitor and writes nothing', async () => {
    const m = makeMockClient()
    const client = {
      ...m.client,
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as SupabaseClient<Database>

    expect(await saveCookiePrefsForCurrentUser(client, acceptAllPreferences())).toBe(false)
    expect(m.mockFrom).not.toHaveBeenCalled()
  })

  it('persists to the signed-in user row', async () => {
    const m = makeMockClient()
    m.queueList(null)
    const client = {
      from: m.mockFrom,
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-9' } } }) },
    } as unknown as SupabaseClient<Database>

    expect(await saveCookiePrefsForCurrentUser(client, acceptAllPreferences())).toBe(true)
    expect(m.chain.eq).toHaveBeenCalledWith('id', 'user-9')
  })
})

describe('notification preferences (CL-4)', () => {
  it('reads the notification matrix from profile_settings', async () => {
    const m = makeMockClient()
    const matrix = { new_match: { push: true, email: false, in_app: true } }
    m.queueSingle({ notification_matrix: matrix })

    expect(await getNotificationMatrix(m.client, 'user-1')).toEqual(matrix)
    expect(m.mockFrom).toHaveBeenCalledWith('profile_settings')
  })

  it('returns an empty matrix when the column holds a non-object', async () => {
    const m = makeMockClient()
    m.queueSingle({ notification_matrix: null })
    expect(await getNotificationMatrix(m.client, 'user-1')).toEqual({})
  })

  it('merges a patch instead of replacing the whole matrix', async () => {
    const m = makeMockClient()
    m.queueSingle({
      notification_matrix: {
        new_match: { push: true, email: true },
        payment_received: { email: true },
      },
    })
    m.queueSingle({
      notification_matrix: {
        new_match: { push: true, email: false },
        payment_received: { email: true },
      },
    })

    const result = await updateNotificationMatrix(m.client, 'user-1', {
      new_match: { email: false },
    })

    expect(m.chain.update).toHaveBeenCalledWith({
      notification_matrix: {
        new_match: { push: true, email: false },
        payment_received: { email: true },
      },
    })
    expect(result.new_match?.push).toBe(true)
  })

  it('unsubscribe clears every email channel, the digest and marketing opt-in', async () => {
    const m = makeMockClient()
    m.queueSingle({
      notification_matrix: {
        new_match: { push: true, email: true },
        payment_received: { email: true, in_app: true },
      },
    })
    m.queueSingle({ notification_matrix: {} })

    await unsubscribeFromAllEmail(m.client, 'user-1')

    expect(m.chain.update).toHaveBeenCalledWith({
      notification_matrix: {
        new_match: { push: true, email: false },
        payment_received: { email: false, in_app: true },
      },
      email_digest: 'off',
      marketing_opt_in: false,
    })
  })
})
