import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import MessageBubble from './message-bubble'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

const base: MessageRow = {
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
  sender_id: 'u1',
  sent_at: '2026-06-16T10:00:00.000Z',
  text_content: 'Hello there',
}

describe('MessageBubble', () => {
  it('aligns the sender (mine) bubble to the right with the primary colour', () => {
    const { container } = render(<MessageBubble message={base} isMine />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('justify-end')
    // Sender bubble uses the single action colour (primary), not grey.
    expect(container.querySelector('.bg-primary')).not.toBeNull()
  })

  it('aligns the receiver bubble to the left with a grey/muted colour', () => {
    const { container } = render(<MessageBubble message={base} isMine={false} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('justify-start')
    expect(container.querySelector('.bg-muted')).not.toBeNull()
  })

  it('hides the timestamp until the bubble is tapped/clicked', async () => {
    const user = userEvent.setup()
    render(<MessageBubble message={base} isMine={false} />)

    // Timestamp not visible initially.
    expect(screen.queryByTestId('bubble-timestamp')).toBeNull()

    await user.click(screen.getByText('Hello there'))

    expect(screen.getByTestId('bubble-timestamp')).toBeInTheDocument()
  })

  it('shows a single tick for delivered own messages and a double tick when read', () => {
    const { rerender } = render(
      <MessageBubble message={base} isMine readByOther={false} />
    )
    expect(screen.getByTestId('receipt-delivered')).toBeInTheDocument()
    expect(screen.queryByTestId('receipt-read')).toBeNull()

    rerender(<MessageBubble message={base} isMine readByOther />)
    expect(screen.getByTestId('receipt-read')).toBeInTheDocument()
  })

  it('does not render read receipts on the receiver bubble', () => {
    render(<MessageBubble message={base} isMine={false} readByOther />)
    expect(screen.queryByTestId('receipt-delivered')).toBeNull()
    expect(screen.queryByTestId('receipt-read')).toBeNull()
  })

  it('renders a file attachment as a preview tile with name, size and a download link', () => {
    const fileMsg: MessageRow = {
      ...base,
      content_type: 'document',
      text_content: null,
      attachment_url: 'https://cdn.example.com/brief.pdf',
      attachment_mime_type: 'application/pdf',
      attachment_size_bytes: 1024 * 1024 * 2, // 2 MB
      metadata: { file_name: 'brief.pdf' },
    }
    render(<MessageBubble message={fileMsg} isMine={false} />)

    expect(screen.getByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2(\.0)? MB/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /download/i })
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/brief.pdf')
  })
})

describe('MessageBubble long-text wrapping (PR-18)', () => {
  const long = 'a'.repeat(400)

  it('wraps a single unbroken token instead of blowing out the row', () => {
    render(<MessageBubble message={{ ...base, text_content: long }} isMine={false} />)
    const text = screen.getByText(long)
    expect(text.className).toMatch(/break-words/)
    expect(text.className).toMatch(/overflow-wrap:anywhere/)
    expect(text.className).toMatch(/whitespace-pre-wrap/)
  })

  it('caps the bubble width relative to the conversation column', () => {
    render(<MessageBubble message={{ ...base, text_content: long }} isMine={false} />)
    const bubble = screen.getByRole('button', { name: /show timestamp/i })
    expect(bubble.className).toMatch(/max-w-\[75%\]/)
    expect(bubble.className).toContain('min-w-0')
    expect(bubble.className).toMatch(/overflow-wrap:anywhere/)
  })

  it('gives the bubble a visible focus ring, not an outline-only cue (A-4)', () => {
    render(<MessageBubble message={{ ...base, text_content: 'hi' }} isMine={false} />)
    const bubble = screen.getByRole('button', { name: /show timestamp/i })
    expect(bubble.className).toContain('focus-visible:ring-2')
    expect(bubble.className).toContain('focus-visible:ring-ring')
  })
})
