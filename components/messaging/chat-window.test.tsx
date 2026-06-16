import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Database } from '@/types/database'
import ChatWindow from './chat-window'

type MessageRow = Database['public']['Tables']['messages']['Row']

// Capture the typing callback registered by ChatWindow so the test can drive it.
let typingCb: ((p: { userId: string; isTyping: boolean }) => void) | null = null

vi.mock('@/lib/realtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/realtime')>('@/lib/realtime')
  return {
    ...actual,
    typingChannel: () => ({ subscribe: () => ({}), on: () => ({}) }),
    presenceChannel: () => ({ subscribe: () => ({}), on: () => ({}) }),
    onTyping: (_channel: unknown, cb: (p: { userId: string; isTyping: boolean }) => void) => {
      typingCb = cb
      return {}
    },
    onReadReceipt: () => ({}),
    onPresenceSync: () => ({}),
    trackPresence: vi.fn(),
    sendTyping: vi.fn(),
    sendReadReceipt: vi.fn(),
    closeChannel: vi.fn(),
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }),
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const baseMsg: MessageRow = {
  attachment_mime_type: null,
  attachment_size_bytes: null,
  attachment_url: null,
  content_type: 'text',
  created_at: '2026-06-16T10:00:00.000Z',
  deleted_at: null,
  id: 'msg1',
  is_deleted: false,
  match_id: 'm1',
  metadata: {},
  sender_id: 'other',
  sent_at: '2026-06-16T10:00:00.000Z',
  text_content: 'Hi',
}

const props = {
  matchId: 'm1',
  initialMessages: [baseMsg],
  proposals: [],
  currentUserId: 'me',
}

describe('ChatWindow', () => {
  it('shows an animated three-dot typing indicator when the other user is typing', () => {
    render(<ChatWindow {...props} />)
    expect(screen.queryByTestId('typing-indicator')).toBeNull()

    act(() => {
      typingCb?.({ userId: 'other', isTyping: true })
    })
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()

    act(() => {
      typingCb?.({ userId: 'other', isTyping: false })
    })
    expect(screen.queryByTestId('typing-indicator')).toBeNull()
  })

  it('ignores typing signals from the current user', () => {
    render(<ChatWindow {...props} />)
    act(() => {
      typingCb?.({ userId: 'me', isTyping: true })
    })
    expect(screen.queryByTestId('typing-indicator')).toBeNull()
  })
})
