import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import ListingsBrowser from './listings-browser'
import type { ListingSummary } from '@/lib/supabase/discovery'

const listing = (over: Partial<ListingSummary> = {}): ListingSummary => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'Acme',
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

describe('ListingsBrowser', () => {
  it('renders the grid by default and the toggle above it', () => {
    render(<ListingsBrowser listings={[listing()]} initialMode="marketplace" />)
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    expect(screen.getByTestId('listings-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('swipe-deck')).toBeNull()
  })

  it('persists the chosen mode to the profile column', async () => {
    render(<ListingsBrowser listings={[listing()]} initialMode="marketplace" />)
    await userEvent.click(screen.getByRole('radio', { name: /swipe/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profiles/me')
    expect((init as RequestInit).method).toBe('PATCH')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      discovery_ui_mode: 'swipe',
    })
  })

  // PR-23: "interested" must run the same persisted action as the grid's save
  // path — not a local state flip that evaporates on reload.
  it('swiping interested shortlists the listing brand through the real API', async () => {
    render(<ListingsBrowser listings={[listing()]} initialMode="swipe" />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/discovery/shortlist')
      expect(call).toBeDefined()
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        target_user_id: 'brand-user-1',
      })
    })
  })

  it('skipping does not mutate anything', async () => {
    render(<ListingsBrowser listings={[listing(), listing({ id: 'l2' })]} initialMode="swipe" />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))

    expect(fetchMock.mock.calls.some(([url]) => url === '/api/discovery/shortlist')).toBe(false)
  })

  it('advances the deck and shows an empty state once the queue drains', async () => {
    render(<ListingsBrowser listings={[listing()]} initialMode="swipe" />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))

    expect(screen.queryByTestId('swipe-card')).toBeNull()
    expect(screen.getByText(/that is every campaign for now/i)).toBeInTheDocument()
  })
})
