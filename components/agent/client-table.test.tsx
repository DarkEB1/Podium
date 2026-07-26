import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ClientTable, { type AgentClientRow } from './client-table'

const clients: AgentClientRow[] = [
  {
    linkId: 'link-1',
    clientUserId: 'user-1',
    name: 'Maya Okoro',
    photoUrl: 'https://cdn.test/maya.jpg',
    sport: 'Athletics',
    level: 'National',
    activeDeals: 2,
    lastActivity: '2026-06-10T12:00:00.000Z',
  },
  {
    linkId: 'link-2',
    clientUserId: 'user-2',
    name: 'Tom Reed',
    photoUrl: null,
    sport: 'Rowing',
    level: 'University/BUCS',
    activeDeals: 0,
    lastActivity: null,
  },
]

describe('ClientTable', () => {
  it('renders a row per client with photo, name, sport, level and active deals', () => {
    render(<ClientTable clients={clients} onRevoke={vi.fn()} />)

    expect(screen.getByText('Maya Okoro')).toBeInTheDocument()
    expect(screen.getByText('Athletics')).toBeInTheDocument()
    expect(screen.getByText('National')).toBeInTheDocument()

    const photo = screen.getByAltText('Maya Okoro') as HTMLImageElement
    expect(photo.tagName).toBe('IMG')
    expect(photo.src).toContain('maya.jpg')

    // active deals count surfaced
    const mayaRow = screen.getByText('Maya Okoro').closest('tr')!
    expect(within(mayaRow).getByText('2')).toBeInTheDocument()
  })

  // B-4: the "Message" action was removed — /agent/messages does not exist and
  // the link 404'd. Restore it here when an agent messaging surface ships.
  it('exposes the available quick actions per client', () => {
    render(<ClientTable clients={clients} onRevoke={vi.fn()} />)
    const mayaRow = screen.getByText('Maya Okoro').closest('tr')!
    const row = within(mayaRow)
    expect(row.getByRole('link', { name: /view profile/i })).toBeInTheDocument()
    expect(row.queryByRole('link', { name: /^message$/i })).toBeNull()
    expect(row.getByRole('link', { name: /view deals/i })).toBeInTheDocument()
    expect(row.getByRole('button', { name: /revoke access/i })).toBeInTheDocument()
  })

  it('calls onRevoke with the link id when Revoke Access is pressed', () => {
    const onRevoke = vi.fn()
    render(<ClientTable clients={clients} onRevoke={onRevoke} />)
    const mayaRow = screen.getByText('Maya Okoro').closest('tr')!
    act(() => {
      fireEvent.click(within(mayaRow).getByRole('button', { name: /revoke access/i }))
    })
    expect(onRevoke).toHaveBeenCalledWith('link-1')
  })

  it('shows an empty state when there are no clients', () => {
    render(<ClientTable clients={[]} onRevoke={vi.fn()} />)
    expect(screen.getByText(/no clients yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
