import { describe, it, expect, vi } from 'vitest'
import {
  getNotifications,
  markRead,
  createNotification,
  NotificationsError,
} from './notifications'
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
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
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
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const notif1 = {
  id: 'notif-1',
  user_id: 'user-1',
  event_type: 'connection_request_received',
  channel: 'in_app' as const,
  title: 'New connection request',
  body: 'Someone wants to connect',
  metadata: {},
  sent_at: '2026-04-20T10:00:00Z',
  read_at: null,
  created_at: '2026-04-20T10:00:00Z',
}

const notif2 = {
  ...notif1,
  id: 'notif-2',
  channel: 'email' as const,
  event_type: 'payment_received',
  title: 'Payment received',
  body: 'You received a payment',
}

// ---------------------------------------------------------------------------
// getNotifications
// ---------------------------------------------------------------------------

describe('getNotifications', () => {
  it('returns list of notifications for user', async () => {
    const mock = makeMockClient()
    mock.queueList([notif1, notif2])
    const result = await getNotifications(mock.client, 'user-1')
    expect(result).toEqual([notif1, notif2])
    expect(mock.mockFrom).toHaveBeenCalledWith('notification_logs')
  })

  it('returns empty array when no notifications exist', async () => {
    const mock = makeMockClient()
    mock.queueList([])
    const result = await getNotifications(mock.client, 'user-1')
    expect(result).toEqual([])
  })

  // WS-MSG-14: the bell must only ever show the in_app copy of an event, never
  // its email/push siblings.
  it('filters to the in_app channel', async () => {
    const mock = makeMockClient()
    mock.queueList([notif1])
    await getNotifications(mock.client, 'user-1')
    expect(mock.chain.eq).toHaveBeenCalledWith('channel', 'in_app')
  })

  it('throws NotificationsError on DB error', async () => {
    const mock = makeMockClient()
    mock.queueList(null, { message: 'connection error' })
    await expect(getNotifications(mock.client, 'user-1')).rejects.toThrow(NotificationsError)
  })
})

// ---------------------------------------------------------------------------
// markRead
// ---------------------------------------------------------------------------

describe('markRead', () => {
  it('updates read_at and returns updated notification', async () => {
    const mock = makeMockClient()
    const updated = { ...notif1, read_at: '2026-04-20T11:00:00Z' }
    mock.queueSingle(updated)
    const result = await markRead(mock.client, 'notif-1', 'user-1')
    expect(result.read_at).not.toBeNull()
    expect(mock.mockFrom).toHaveBeenCalledWith('notification_logs')
  })

  it('throws NOTIFICATION_NOT_FOUND when notification does not exist', async () => {
    const mock = makeMockClient()
    mock.queueSingle(null, { code: 'PGRST116', message: 'not found' })
    await expect(markRead(mock.client, 'bad-id', 'user-1')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    })
  })

  it('throws NotificationsError on other DB errors', async () => {
    const mock = makeMockClient()
    mock.queueSingle(null, { code: '500', message: 'server error' })
    await expect(markRead(mock.client, 'notif-1', 'user-1')).rejects.toThrow(NotificationsError)
  })
})

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

describe('createNotification', () => {
  it('inserts and returns new notification', async () => {
    const mock = makeMockClient()
    mock.queueSingle(notif1)
    const payload = {
      user_id: 'user-1',
      event_type: 'connection_request_received',
      channel: 'in_app' as const,
      title: 'New connection request',
      body: 'Someone wants to connect',
    }
    const result = await createNotification(mock.client, payload)
    expect(result).toEqual(notif1)
    expect(mock.mockFrom).toHaveBeenCalledWith('notification_logs')
  })

  it('throws NotificationsError on DB error', async () => {
    const mock = makeMockClient()
    mock.queueSingle(null, { message: 'insert failed' })
    await expect(
      createNotification(mock.client, {
        user_id: 'user-1',
        event_type: 'payment_received',
        channel: 'email',
        title: 'Payment',
        body: 'You got paid',
      })
    ).rejects.toThrow(NotificationsError)
  })
})
