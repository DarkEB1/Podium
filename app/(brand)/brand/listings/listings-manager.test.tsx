import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ListingsManager from './listings-manager'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

type Listing = Parameters<typeof ListingsManager>[0]['listings'][number]

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'list-1',
    title: 'Summer 2026 Football',
    type: 'athlete_endorsement',
    status: 'active',
    sport_required: 'Football',
    ...over,
  } as Listing
}

describe('ListingsManager', () => {
  beforeEach(() => {
    push.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'list-1', status: 'paused' }) }),
    )
  })

  it('renders each listing with its title and status', () => {
    render(<ListingsManager listings={[listing(), listing({ id: 'list-2', title: 'Winter Camp', status: 'paused' })]} />)
    expect(screen.getByText('Summer 2026 Football')).toBeInTheDocument()
    expect(screen.getByText('Winter Camp')).toBeInTheDocument()
  })

  it('pauses an active listing via PATCH to the dedicated /status route', async () => {
    render(<ListingsManager listings={[listing()]} />)
    await userEvent.click(screen.getByRole('button', { name: /pause/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/listings/list-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'paused' }),
        }),
      ),
    )
  })

  it('resumes a paused listing to active via the /status route', async () => {
    render(<ListingsManager listings={[listing({ status: 'paused' })]} />)
    await userEvent.click(screen.getByRole('button', { name: /resume/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/listings/list-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' }),
        }),
      ),
    )
  })

  it('shows a Publish action for a draft and POSTs to the publish route', async () => {
    render(<ListingsManager listings={[listing({ status: 'draft' })]} />)
    // a draft is not yet live, so it must not offer Pause
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/listings/list-1/publish',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('does not offer Publish for an already-active listing', () => {
    render(<ListingsManager listings={[listing({ status: 'active' })]} />)
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument()
  })

  it('closes a listing only after confirming', async () => {
    render(<ListingsManager listings={[listing()]} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    // confirmation must appear before any request
    expect(fetch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })

  it('duplicate routes to the new listing page pre-filled from the source', async () => {
    render(<ListingsManager listings={[listing()]} />)
    await userEvent.click(screen.getByRole('button', { name: /duplicate/i }))
    expect(push).toHaveBeenCalledWith('/brand/listings/new?from=list-1')
  })
})
