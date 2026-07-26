import { describe, it, expect, vi } from 'vitest'
import {
  sendMessage,
  getMessages,
  deleteMessage,
  getMatches,
  getConversations,
  markMatchRead,
  MessagingError,
} from './messaging'
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
  chain.or.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const mockFrom = vi.fn().mockReturnValue(chain)

  const rpcQueue: Array<{ data: unknown; error: unknown }> = []
  const mockRpc = vi.fn().mockImplementation(() => {
    const r = rpcQueue.shift() ?? { data: null, error: null }
    return Promise.resolve(r)
  })

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

const fakeActiveMatch = {
  id: 'm1',
  user_a_id: 'u1',
  user_b_id: 'u2',
  status: 'active',
  proposal_required: false,
  proposal_sent: false,
  matched_at: '2026-04-19T00:00:00Z',
  connection_request_id: null,
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
}

const fakeMessage = {
  id: 'msg1',
  match_id: 'm1',
  sender_id: 'u1',
  content_type: 'text',
  text_content: 'Hello!',
  attachment_url: null,
  attachment_size_bytes: null,
  attachment_mime_type: null,
  metadata: {},
  is_deleted: false,
  deleted_at: null,
  sent_at: '2026-04-19T00:00:00Z',
  created_at: '2026-04-19T00:00:00Z',
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

describe('sendMessage', () => {
  it('inserts message with match_id, sender_id, content_type, and payload', async () => {
    const { client, chain, mockFrom, queueSingle } = makeMockClient()
    queueSingle(fakeActiveMatch)
    queueSingle(fakeMessage)

    await sendMessage(client, 'm1', 'u1', 'text', { text_content: 'Hello!' })

    expect(mockFrom).toHaveBeenCalledWith('messages')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ match_id: 'm1', sender_id: 'u1', content_type: 'text', text_content: 'Hello!' })
    )
  })

  it('returns the created message row', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeActiveMatch)
    queueSingle(fakeMessage)

    const result = await sendMessage(client, 'm1', 'u1', 'text', { text_content: 'Hello!' })

    expect(result).toEqual(fakeMessage)
  })

  it('throws MATCH_NOT_FOUND on PGRST116 when fetching match', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(sendMessage(client, 'm1', 'u1', 'text', {})).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    })
  })

  it('throws MATCH_NOT_FOUND on other match fetch DB error', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: '42000', message: 'db error' })

    await expect(sendMessage(client, 'm1', 'u1', 'text', {})).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    })
  })

  it('throws PROPOSAL_REQUIRED when gate is active and content_type is not proposal_card', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: true, proposal_sent: false })

    await expect(
      sendMessage(client, 'm1', 'u1', 'text', { text_content: 'Hi' })
    ).rejects.toMatchObject({ code: 'PROPOSAL_REQUIRED' })
  })

  it('allows proposal_card when proposal gate is active', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: true, proposal_sent: false })
    queueSingle({ ...fakeMessage, content_type: 'proposal_card' })
    queueList(null)

    await expect(
      sendMessage(client, 'm1', 'u1', 'proposal_card', { metadata: { title: 'Deal' } })
    ).resolves.toBeDefined()
  })

  it('flips proposal_sent to true on match after sending a proposal_card', async () => {
    const { client, chain, queueSingle, queueList } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: true, proposal_sent: false })
    queueSingle({ ...fakeMessage, content_type: 'proposal_card' })
    queueList(null)

    await sendMessage(client, 'm1', 'u1', 'proposal_card', {})

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ proposal_sent: true }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'm1')
  })

  it('allows any content type when proposal_sent is already true', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: true, proposal_sent: true })
    queueSingle(fakeMessage)

    await expect(
      sendMessage(client, 'm1', 'u1', 'text', { text_content: 'Hi' })
    ).resolves.toBeDefined()
  })

  it('allows any content type when proposal_required is false', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: false })
    queueSingle(fakeMessage)

    await expect(
      sendMessage(client, 'm1', 'u1', 'text', { text_content: 'Hi' })
    ).resolves.toBeDefined()
  })

  it('throws MESSAGE_INSERT_FAILED on insert DB error', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(fakeActiveMatch)
    queueSingle(null, { code: '42000', message: 'insert failed' })

    await expect(sendMessage(client, 'm1', 'u1', 'text', {})).rejects.toMatchObject({
      code: 'MESSAGE_INSERT_FAILED',
    })
  })

  it('throws PROPOSAL_FLIP_FAILED when the proposal_sent update fails', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ ...fakeActiveMatch, proposal_required: true, proposal_sent: false })
    queueSingle({ ...fakeMessage, content_type: 'proposal_card' })
    queueList(null, { message: 'update failed' })

    await expect(sendMessage(client, 'm1', 'u1', 'proposal_card', {})).rejects.toMatchObject({
      code: 'PROPOSAL_FLIP_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

describe('getMessages', () => {
  it('throws MATCH_NOT_FOUND when match does not exist (PGRST116)', async () => {
    const { client, queueSingle } = makeMockClient()
    queueSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(getMessages(client, 'm1')).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    })
  })

  it('selects non-deleted messages for match ordered by sent_at', async () => {
    const { client, mockFrom, chain, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList([fakeMessage])

    await getMessages(client, 'm1')

    expect(mockFrom).toHaveBeenCalledWith('messages')
    expect(chain.eq).toHaveBeenCalledWith('match_id', 'm1')
    expect(chain.eq).toHaveBeenCalledWith('is_deleted', false)
    expect(chain.order).toHaveBeenCalledWith('sent_at', { ascending: true })
  })

  it('returns messages array', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList([fakeMessage])

    const result = await getMessages(client, 'm1')

    expect(result).toEqual([fakeMessage])
  })

  it('returns empty array when no messages', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList(null)

    const result = await getMessages(client, 'm1')

    expect(result).toEqual([])
  })

  it('throws MESSAGES_FETCH_FAILED on messages DB error', async () => {
    const { client, queueSingle, queueList } = makeMockClient()
    queueSingle({ id: 'm1' })
    queueList(null, { message: 'db error' })

    await expect(getMessages(client, 'm1')).rejects.toMatchObject({
      code: 'MESSAGES_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// deleteMessage
// ---------------------------------------------------------------------------

describe('deleteMessage', () => {
  it('sets is_deleted to true and records deleted_at', async () => {
    const { client, chain, mockFrom, setSingle } = makeMockClient()
    setSingle({ id: 'msg1', is_deleted: true })

    const before = new Date()
    await deleteMessage(client, 'msg1', 'u1')
    const after = new Date()

    expect(mockFrom).toHaveBeenCalledWith('messages')
    const updateArg = chain.update.mock.calls[0]![0] as Record<string, unknown>
    expect(updateArg['is_deleted']).toBe(true)
    const deletedAt = new Date(updateArg['deleted_at'] as string)
    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(deletedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('filters by message_id and sender_id', async () => {
    const { client, chain, setSingle } = makeMockClient()
    setSingle({ id: 'msg1' })

    await deleteMessage(client, 'msg1', 'u1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'msg1')
    expect(chain.eq).toHaveBeenCalledWith('sender_id', 'u1')
  })

  it('throws MESSAGE_NOT_FOUND on PGRST116', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: 'PGRST116', message: 'no rows' })

    await expect(deleteMessage(client, 'msg1', 'u1')).rejects.toMatchObject({
      code: 'MESSAGE_NOT_FOUND',
    })
  })

  it('throws MESSAGE_DELETE_FAILED on other DB errors', async () => {
    const { client, setSingle } = makeMockClient()
    setSingle(null, { code: '42501', message: 'permission denied' })

    await expect(deleteMessage(client, 'msg1', 'u1')).rejects.toMatchObject({
      code: 'MESSAGE_DELETE_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getMatches
// ---------------------------------------------------------------------------

describe('getMatches', () => {
  it('selects active matches where user is a participant', async () => {
    const { client, mockFrom, chain, setChainResult } = makeMockClient()
    setChainResult([fakeActiveMatch])

    await getMatches(client, 'u1')

    expect(mockFrom).toHaveBeenCalledWith('matches')
    expect(chain.or).toHaveBeenCalledWith('user_a_id.eq.u1,user_b_id.eq.u1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
  })

  it('returns matches array', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult([fakeActiveMatch])

    const result = await getMatches(client, 'u1')

    expect(result).toEqual([fakeActiveMatch])
  })

  it('returns empty array when data is null', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null)

    const result = await getMatches(client, 'u1')

    expect(result).toEqual([])
  })

  it('throws MATCHES_FETCH_FAILED on DB error', async () => {
    const { client, setChainResult } = makeMockClient()
    setChainResult(null, { message: 'db error' })

    await expect(getMatches(client, 'u1')).rejects.toMatchObject({
      code: 'MATCHES_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// getConversations (SB-3 / L-3)
// ---------------------------------------------------------------------------

const fakeInboxRow = {
  match_id: 'm1',
  other_user_id: 'u2',
  display_name: 'Northwind',
  avatar_url: 'https://cdn.test/logo.png',
  last_message_text: 'Hello!',
  last_message_type: 'text',
  last_message_at: '2026-04-20T10:00:00Z',
  matched_at: '2026-04-19T00:00:00Z',
  unread_count: 3,
}

describe('getConversations', () => {
  it('resolves the whole inbox in a SINGLE query (no N+1)', async () => {
    const { client, mockRpc, mockFrom, queueRpc } = makeMockClient()
    queueRpc([fakeInboxRow])

    await getConversations(client, 'u1')

    expect(mockRpc).toHaveBeenCalledTimes(1)
    // SEC-9: the RPC now takes p_include_archived (default false) so archived
    // conversations are reachable and can therefore be un-archived.
    expect(mockRpc).toHaveBeenCalledWith('get_conversations', { p_include_archived: false })
    // No per-match profile probes or last-message lookups any more.
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('asks the RPC for archived conversations when includeArchived is set', async () => {
    const { client, mockRpc, queueRpc } = makeMockClient()
    queueRpc([fakeInboxRow])

    await getConversations(client, 'u1', { includeArchived: true })

    expect(mockRpc).toHaveBeenCalledWith('get_conversations', { p_include_archived: true })
  })

  it('maps a row onto the Conversation view-model', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([fakeInboxRow])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation).toEqual({
      id: 'm1',
      name: 'Northwind',
      avatarUrl: 'https://cdn.test/logo.png',
      preview: 'Hello!',
      timestamp: '2026-04-20T10:00:00Z',
      unreadCount: 3,
    })
  })

  it('reports the real unread count instead of a hardcoded 0', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([{ ...fakeInboxRow, unread_count: 7 }])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.unreadCount).toBe(7)
  })

  it('previews a proposal card', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([{ ...fakeInboxRow, last_message_type: 'proposal_card', last_message_text: null }])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.preview).toBe('Sent a proposal')
  })

  it('previews a payment confirmation', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([
      { ...fakeInboxRow, last_message_type: 'payment_confirmation', last_message_text: null },
    ])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.preview).toBe('Payment confirmed')
  })

  it('previews an attachment-only message', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([{ ...fakeInboxRow, last_message_type: 'image', last_message_text: null }])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.preview).toBe('Attachment')
  })

  it('falls back to the match timestamp when there are no messages', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([
      {
        ...fakeInboxRow,
        last_message_type: null,
        last_message_text: null,
        last_message_at: null,
        unread_count: 0,
      },
    ])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.preview).toBe('No messages yet')
    expect(conversation?.timestamp).toBe('2026-04-19T00:00:00Z')
  })

  it('falls back to a generic name when no profile resolved', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc([{ ...fakeInboxRow, display_name: null, avatar_url: null }])

    const [conversation] = await getConversations(client, 'u1')

    expect(conversation?.name).toBe('Conversation')
    expect(conversation?.avatarUrl).toBeNull()
  })

  it('returns an empty array when the inbox is empty', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null)

    await expect(getConversations(client, 'u1')).resolves.toEqual([])
  })

  it('throws CONVERSATIONS_FETCH_FAILED on DB error', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { message: 'boom' })

    await expect(getConversations(client, 'u1')).rejects.toMatchObject({
      code: 'CONVERSATIONS_FETCH_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// markMatchRead (L-3)
// ---------------------------------------------------------------------------

describe('markMatchRead', () => {
  it('calls the mark_match_read RPC for the match', async () => {
    const { client, mockRpc, queueRpc } = makeMockClient()
    queueRpc('2026-04-20T12:00:00Z')

    await markMatchRead(client, 'm1')

    expect(mockRpc).toHaveBeenCalledWith('mark_match_read', { p_match_id: 'm1' })
  })

  it('throws MARK_READ_FAILED on DB error', async () => {
    const { client, queueRpc } = makeMockClient()
    queueRpc(null, { message: 'nope' })

    await expect(markMatchRead(client, 'm1')).rejects.toMatchObject({
      code: 'MARK_READ_FAILED',
    })
  })
})

// ---------------------------------------------------------------------------
// MessagingError
// ---------------------------------------------------------------------------

describe('MessagingError', () => {
  it('is an instance of Error with a code property', () => {
    const err = new MessagingError('TEST_CODE', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.name).toBe('MessagingError')
  })
})
