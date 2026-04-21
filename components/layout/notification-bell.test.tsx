import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotificationBell from './notification-bell'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows 0 badge when no unread notifications', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/notifications'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows unread count badge', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', title: 'Hello', body: 'You got a match', read_at: null, created_at: '2024-01-01', event_type: 'match', channel: 'in_app', metadata: {}, sent_at: '2024-01-01', user_id: 'u1' },
        { id: '2', title: 'Offer', body: 'Brand sent proposal', read_at: null, created_at: '2024-01-02', event_type: 'proposal', channel: 'in_app', metadata: {}, sent_at: '2024-01-02', user_id: 'u1' },
      ],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('opens dropdown on click and shows notification titles', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', title: 'New match', body: 'Nike wants to connect', read_at: null, created_at: '2024-01-01', event_type: 'match', channel: 'in_app', metadata: {}, sent_at: '2024-01-01', user_id: 'u1' },
      ],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('New match')).toBeInTheDocument()
  })
})
