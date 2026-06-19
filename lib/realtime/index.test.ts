import { describe, it, expect, vi } from 'vitest'
import {
  typingChannel,
  presenceChannel,
  sendTyping,
  onTyping,
  sendReadReceipt,
  onReadReceipt,
  trackPresence,
  onPresenceSync,
  RealtimeError,
  TYPING_EVENT,
  READ_RECEIPT_EVENT,
} from './index'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock Supabase Realtime channel
// ---------------------------------------------------------------------------

function makeMockChannel() {
  const handlers: Array<{ type: string; filter: unknown; cb: (p: unknown) => void }> = []
  const channel = {
    on: vi.fn((type: string, filter: unknown, cb: (p: unknown) => void) => {
      handlers.push({ type, filter, cb })
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED')
      return channel
    }),
    send: vi.fn().mockResolvedValue('ok'),
    track: vi.fn().mockResolvedValue('ok'),
    untrack: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn().mockReturnValue({}),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    // expose for assertions
    __handlers: handlers,
    __emit(type: string, payload: unknown) {
      handlers.filter((h) => h.type === type).forEach((h) => h.cb(payload))
    },
  }
  return channel
}

function makeMockClient() {
  const channel = makeMockChannel()
  const mockChannel = vi.fn().mockReturnValue(channel)
  const removeChannel = vi.fn().mockResolvedValue('ok')
  return {
    client: { channel: mockChannel, removeChannel } as unknown as SupabaseClient<Database>,
    channel,
    mockChannel,
    removeChannel,
  }
}

// ---------------------------------------------------------------------------
// typingChannel / presenceChannel naming
// ---------------------------------------------------------------------------

describe('typingChannel', () => {
  it('opens a channel namespaced to the match id', () => {
    const mock = makeMockClient()
    const ch = typingChannel(mock.client, 'match-1')
    expect(mock.mockChannel).toHaveBeenCalledWith('typing:match-1')
    expect(ch).toBe(mock.channel)
  })

  it('throws RealtimeError when matchId is empty', () => {
    const mock = makeMockClient()
    expect(() => typingChannel(mock.client, '')).toThrow(RealtimeError)
  })
})

describe('presenceChannel', () => {
  it('opens a presence channel namespaced to the match id with the user key', () => {
    const mock = makeMockClient()
    const ch = presenceChannel(mock.client, 'match-1', 'user-1')
    expect(mock.mockChannel).toHaveBeenCalledWith('presence:match-1', {
      config: { presence: { key: 'user-1' } },
    })
    expect(ch).toBe(mock.channel)
  })

  it('throws RealtimeError when ids are empty', () => {
    const mock = makeMockClient()
    expect(() => presenceChannel(mock.client, '', 'user-1')).toThrow(RealtimeError)
    expect(() => presenceChannel(mock.client, 'match-1', '')).toThrow(RealtimeError)
  })
})

// ---------------------------------------------------------------------------
// Typing indicator broadcast
// ---------------------------------------------------------------------------

describe('typing indicator', () => {
  it('sendTyping broadcasts a typing event with userId and isTyping', async () => {
    const mock = makeMockClient()
    await sendTyping(mock.channel as never, 'user-1', true)
    expect(mock.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: TYPING_EVENT,
      payload: { userId: 'user-1', isTyping: true },
    })
  })

  it('onTyping registers a broadcast handler and forwards the payload', () => {
    const mock = makeMockClient()
    const cb = vi.fn()
    onTyping(mock.channel as never, cb)
    expect(mock.channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: TYPING_EVENT },
      expect.any(Function)
    )
    mock.channel.__emit('broadcast', { payload: { userId: 'user-2', isTyping: true } })
    expect(cb).toHaveBeenCalledWith({ userId: 'user-2', isTyping: true })
  })
})

// ---------------------------------------------------------------------------
// Read receipts (ephemeral broadcast — messages table has no read_at)
// ---------------------------------------------------------------------------

describe('read receipts', () => {
  it('sendReadReceipt broadcasts the last-read message id and reader', async () => {
    const mock = makeMockClient()
    await sendReadReceipt(mock.channel as never, 'user-1', 'msg-9', '2026-06-16T10:00:00Z')
    expect(mock.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: READ_RECEIPT_EVENT,
      payload: { userId: 'user-1', lastReadMessageId: 'msg-9', readAt: '2026-06-16T10:00:00Z' },
    })
  })

  it('onReadReceipt forwards the payload to the callback', () => {
    const mock = makeMockClient()
    const cb = vi.fn()
    onReadReceipt(mock.channel as never, cb)
    expect(mock.channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: READ_RECEIPT_EVENT },
      expect.any(Function)
    )
    const payload = { userId: 'u2', lastReadMessageId: 'm1', readAt: '2026-06-16T10:00:00Z' }
    mock.channel.__emit('broadcast', { payload })
    expect(cb).toHaveBeenCalledWith(payload)
  })
})

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

describe('presence', () => {
  it('trackPresence tracks the user with an online_at timestamp', async () => {
    const mock = makeMockClient()
    await trackPresence(mock.channel as never, { userId: 'user-1', onlineAt: '2026-06-16T10:00:00Z' })
    expect(mock.channel.track).toHaveBeenCalledWith({
      userId: 'user-1',
      onlineAt: '2026-06-16T10:00:00Z',
    })
  })

  it('onPresenceSync registers a sync handler and returns the presence state', () => {
    const mock = makeMockClient()
    mock.channel.presenceState.mockReturnValue({ 'user-2': [{ userId: 'user-2' }] })
    const cb = vi.fn()
    onPresenceSync(mock.channel as never, cb)
    expect(mock.channel.on).toHaveBeenCalledWith('presence', { event: 'sync' }, expect.any(Function))
    mock.channel.__emit('presence', undefined)
    expect(cb).toHaveBeenCalledWith({ 'user-2': [{ userId: 'user-2' }] })
  })
})
