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

  // /api/notifications answers 401 (an expired session in another tab is enough)
  // and 500 with an `{ error }` OBJECT. Storing that made the next render call
  // .filter on a non-array, which threw and unmounted every page with the bell.
  it('ignores a 401 response and keeps the bell rendered', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }),
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/notifications'))
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
  })

  it('ignores a 200 body that is not an array', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ error: { code: 'UNKNOWN', message: 'Something went wrong' } }),
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/notifications'))
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
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
