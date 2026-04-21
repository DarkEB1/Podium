import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConnectionRequestCard from './connection-request-card'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

const makeRequest = (): ConnectionRequestRow => ({
  id: 'req1',
  sender_id: 'brand1',
  recipient_id: 'athlete1',
  message: 'We would love to work with you!',
  status: 'pending',
  sent_at: '2024-01-01T00:00:00Z',
  responded_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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
})
