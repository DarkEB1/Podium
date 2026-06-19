import { describe, it, expect, vi } from 'vitest'
import { dispatchNotification, NotificationDispatchError } from './index'
import * as queries from '@/lib/supabase/notifications'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const adminClient = {} as unknown as SupabaseClient<Database>

function fakeLog(channel: Database['public']['Enums']['notification_channel']) {
  return {
    id: `notif-${channel}`,
    user_id: 'user-1',
    event_type: 'connection_request_received',
    channel,
    title: 'New connection request',
    body: 'Someone wants to connect',
    metadata: {},
    sent_at: '2026-06-16T10:00:00Z',
    read_at: null,
    created_at: '2026-06-16T10:00:00Z',
  }
}

describe('dispatchNotification', () => {
  it('persists an in_app log for every requested channel', async () => {
    const spy = vi
      .spyOn(queries, 'createNotification')
      .mockImplementation(async (_c, payload) => fakeLog(payload.channel) as never)

    const result = await dispatchNotification(adminClient, {
      userId: 'user-1',
      eventType: 'connection_request_received',
      title: 'New connection request',
      body: 'Someone wants to connect',
      channels: ['in_app', 'email', 'push'],
    })

    expect(spy).toHaveBeenCalledTimes(3)
    expect(result.map((r) => r.channel).sort()).toEqual(['email', 'in_app', 'push'])
    expect(spy).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({ user_id: 'user-1', channel: 'in_app' })
    )
    spy.mockRestore()
  })

  it('defaults to the in_app channel when none are supplied', async () => {
    const spy = vi
      .spyOn(queries, 'createNotification')
      .mockImplementation(async (_c, payload) => fakeLog(payload.channel) as never)

    const result = await dispatchNotification(adminClient, {
      userId: 'user-1',
      eventType: 'payment_received',
      title: 'Payment received',
      body: 'You got paid',
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.channel).toBe('in_app')
    spy.mockRestore()
  })

  it('forwards metadata to the persisted log', async () => {
    const spy = vi
      .spyOn(queries, 'createNotification')
      .mockImplementation(async (_c, payload) => fakeLog(payload.channel) as never)

    await dispatchNotification(adminClient, {
      userId: 'user-1',
      eventType: 'match_created',
      title: 'New match',
      body: 'You matched',
      channels: ['in_app'],
      metadata: { matchId: 'match-1' },
    })

    expect(spy).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({ metadata: { matchId: 'match-1' } })
    )
    spy.mockRestore()
  })

  it('wraps query failures in NotificationDispatchError', async () => {
    const spy = vi
      .spyOn(queries, 'createNotification')
      .mockRejectedValue(new Error('db down'))

    await expect(
      dispatchNotification(adminClient, {
        userId: 'user-1',
        eventType: 'payment_received',
        title: 'Payment',
        body: 'paid',
        channels: ['in_app'],
      })
    ).rejects.toThrow(NotificationDispatchError)
    spy.mockRestore()
  })

  it('throws NotificationDispatchError when title or body is empty', async () => {
    await expect(
      dispatchNotification(adminClient, {
        userId: 'user-1',
        eventType: 'payment_received',
        title: '',
        body: 'paid',
      })
    ).rejects.toThrow(NotificationDispatchError)
  })
})
