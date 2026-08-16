import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DiscoverDeck } from './discover-deck'
import type { ScoredListing } from '@/lib/discovery/match'

const listing = (over: Partial<ScoredListing> = {}): ScoredListing => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'Acme',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: null,
  title: 'Football Endorsement',
  type: 'athlete_endorsement',
  description: 'desc',
  sport_required: 'Football',
  level_required: null,
  location: 'London',
  is_remote: false,
  pay_type: 'flat_fee',
  pay_amount: 5000,
  pay_currency: 'GBP',
  contract_duration_months: 6,
  application_deadline: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  matchScore: 82,
  matchReasons: ['Matches your sport'],
  ...over,
})

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DiscoverDeck', () => {
  it('starts the progress bar at 0 of N', () => {
    render(<DiscoverDeck listings={[listing(), listing({ id: 'l2' })]} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '2')
    expect(screen.getByText(/0 \/ 2 reviewed/i)).toBeInTheDocument()
  })

  it('saves the listing brand and increments the saved count on a right swipe', async () => {
    render(<DiscoverDeck listings={[listing()]} />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/discovery/shortlist')
      expect(call).toBeDefined()
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        target_user_id: 'brand-user-1',
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    })
  })

  it('skipping does not call the shortlist endpoint', async () => {
    render(<DiscoverDeck listings={[listing(), listing({ id: 'l2' })]} />)

    await userEvent.click(screen.getByRole('button', { name: /skip/i }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/discovery/shortlist')).toBe(false)
  })

  it('shows the payoff with the saved count and a link to the saved page once the queue empties', async () => {
    render(<DiscoverDeck listings={[listing()]} />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/you saved 1/i)).toBeInTheDocument()
    })
    const link = screen.getByRole('link', { name: /send requests/i })
    expect(link).toHaveAttribute('href', '/athlete/saved')
  })

  it('shows a no-saves payoff with a start-over action when nothing was saved', async () => {
    render(<DiscoverDeck listings={[listing()]} />)

    await userEvent.click(screen.getByRole('button', { name: /skip/i }))

    await waitFor(() => {
      expect(screen.getByText(/no saves this round/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
  })

  it('review again resets the queue and counters', async () => {
    render(<DiscoverDeck listings={[listing()]} />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByText(/you saved 1/i)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /review again/i }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })
})
