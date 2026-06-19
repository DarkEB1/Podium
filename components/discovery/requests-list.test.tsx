import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RequestsList from './requests-list'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

const makeRequest = (overrides: Partial<ConnectionRequestRow> = {}): ConnectionRequestRow => ({
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

describe('RequestsList', () => {
  it('renders a designed EmptyState (heading + action) when there are no requests', () => {
    render(<RequestsList requests={[]} />)
    // EmptyState renders the title as a heading — a plain <p> would not.
    const heading = screen.getByRole('heading', { name: /no (pending )?connection requests/i })
    expect(heading).toBeInTheDocument()
    // Designed empty state offers a way forward.
    expect(screen.getByRole('link', { name: /discover|browse|find/i })).toBeInTheDocument()
  })

  it('renders the request cards when requests are present', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<RequestsList requests={[makeRequest()]} />)
    expect(screen.getByText(/we would love to work with you/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /no pending connection requests/i })).toBeNull()
  })
})
