import { render, screen, act, fireEvent } from '@testing-library/react'
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

// WS-DEAL-01/DP-12: ChatWindow now calls useRouter().refresh() after a
// proposal response and opens a counter composer.
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
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

describe('ChatWindow composer (PR-18)', () => {
  it('renders the composer as a width-constrained, wrapping textarea', () => {
    render(<ChatWindow {...props} />)
    const composer = screen.getByTestId('chat-composer')
    expect(composer.tagName).toBe('TEXTAREA')
    // A flex child needs min-w-0 or it refuses to shrink and overflows the row.
    expect(composer.className).toContain('min-w-0')
    expect(composer.className).toContain('w-full')
    // Wrapping, not horizontal growth.
    expect(composer.className).toMatch(/break-words/)
    expect(composer.className).toMatch(/overflow-wrap:anywhere/)
    // Auto-grow caps out and then scrolls rather than growing forever.
    expect(composer.className).toContain('overflow-y-auto')
    expect((composer as HTMLTextAreaElement).style.maxHeight).toBe('160px')
    // Soft wrap is the browser default and must not be turned off.
    expect(composer.getAttribute('wrap')).not.toBe('off')
  })

  it('keeps the composer row itself from overflowing', () => {
    render(<ChatWindow {...props} />)
    const form = screen.getByTestId('chat-composer').closest('form') as HTMLElement
    expect(form.className).toContain('min-w-0')
    expect(form.className).toContain('w-full')
  })

  it('grows with typed content up to the max height, then stops', () => {
    render(<ChatWindow {...props} />)
    const composer = screen.getByTestId('chat-composer') as HTMLTextAreaElement
    // jsdom reports scrollHeight 0, so drive it directly to assert the cap logic.
    Object.defineProperty(composer, 'scrollHeight', { value: 400, configurable: true })
    fireEvent.change(composer, { target: { value: 'x'.repeat(2000) } })
    expect(composer.style.height).toBe('160px')
    expect(composer.style.overflowY).toBe('auto')
  })

  it('gives the icon-only send button an accessible name (A-5)', () => {
    render(<ChatWindow {...props} />)
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })
})

describe('ChatWindow empty state (UX-1)', () => {
  it('shows an empty state instead of a blank pane when there are no messages', () => {
    render(<ChatWindow {...props} initialMessages={[]} />)
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
  })
})
