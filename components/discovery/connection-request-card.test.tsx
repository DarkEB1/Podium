import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConnectionRequestCard from './connection-request-card'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

const makeRequest = (
  overrides: Partial<ConnectionRequestRow> = {}
): ConnectionRequestRow => ({
  id: 'req1',
  sender_id: 'brand1',
  recipient_id: 'athlete1',
  message: 'We would love to work with you!',
  status: 'pending',
  sent_at: '2024-01-01T00:00:00Z',
  responded_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('ConnectionRequestCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders sender id and message', () => {
    render(<ConnectionRequestCard request={makeRequest()} onResponded={vi.fn()} />)
    expect(screen.getByText(/we would love to work with you/i)).toBeInTheDocument()
  })

  it('calls PATCH /api/discovery/connections/[id] with accepted on Accept', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const onResponded = vi.fn()
    render(<ConnectionRequestCard request={makeRequest()} onResponded={onResponded} />)
    await userEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/connections/req1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'accepted' }) })
      )
    )
    expect(onResponded).toHaveBeenCalled()
  })

  it('calls PATCH with declined on Decline', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const onResponded = vi.fn()
    render(<ConnectionRequestCard request={makeRequest()} onResponded={onResponded} />)
    await userEvent.click(screen.getByRole('button', { name: /decline/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/connections/req1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'declined' }) })
      )
    )
  })

  it('renders a read-only accepted card with a Messages hand-off and no action buttons', () => {
    render(
      <ConnectionRequestCard
        request={makeRequest({ status: 'accepted' })}
        messagesHref="/athlete/messages"
      />
    )
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /message them/i })
    expect(link).toHaveAttribute('href', '/athlete/messages')
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument()
  })

  it('renders a declined card as read-only with no hand-off link', () => {
    render(
      <ConnectionRequestCard
        request={makeRequest({ status: 'declined' })}
        messagesHref="/athlete/messages"
      />
    )
    expect(screen.getByText('Declined')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /message them/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept|decline/i })).not.toBeInTheDocument()
  })
})
