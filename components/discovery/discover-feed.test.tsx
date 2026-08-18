import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DiscoverFeed } from './discover-feed'
import type { ScoredListing } from '@/lib/discovery/match'
import type { Rail } from '@/lib/discovery/rails'

const listing = (over: Partial<ScoredListing> = {}): ScoredListing => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'RecoverLab',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: null,
  title: 'Recovery ambassador, UK surf circuit',
  type: 'athlete_endorsement',
  description: 'A recovery brand looking for a surf ambassador.',
  sport_required: 'Surf',
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
  matchScore: 88,
  matchReasons: ['Sport and level match'],
  ...over,
})

const listings: ScoredListing[] = [
  listing(),
  listing({ id: 'l2', title: 'Hydration partner for the summer season', brand_name: 'Apex Fuel' }),
]

const rails: Rail[] = [
  { id: 'because-you-surf', title: 'Because you surf', listings },
  { id: 'top-matches', title: 'Top matches', listings },
]

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderFeed(over: Partial<React.ComponentProps<typeof DiscoverFeed>> = {}) {
  render(
    <DiscoverFeed
      listings={listings}
      rails={rails}
      initialMode="marketplace"
      athleteSport="Surf"
      {...over}
    />
  )
}

describe('DiscoverFeed', () => {
  it('renders the browse-mode toggle', () => {
    renderFeed()
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
  })

  it('renders the rail titles in marketplace mode when no filter is active', () => {
    renderFeed()
    expect(screen.getByTestId('discover-rails')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Because you surf' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Top matches' })).toBeInTheDocument()
    expect(screen.queryByTestId('discover-grid')).toBeNull()
  })

  it('switches from rails to a flat grid when a search is active', async () => {
    renderFeed()
    await userEvent.type(screen.getByRole('searchbox', { name: /search campaigns/i }), 'Hydration')

    await waitFor(() => {
      expect(screen.getByTestId('discover-grid')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('discover-rails')).toBeNull()

    const grid = screen.getByTestId('discover-grid')
    expect(within(grid).getByText('Hydration partner for the summer season')).toBeInTheDocument()
  })

  it('renders the footer under the grid when a filter is active', async () => {
    renderFeed({ footer: <div data-testid="load-more">more</div> })
    await userEvent.type(screen.getByRole('searchbox', { name: /search campaigns/i }), 'Recovery')

    await waitFor(() => {
      expect(screen.getByTestId('discover-grid')).toBeInTheDocument()
    })
    expect(screen.getByTestId('load-more')).toBeInTheDocument()
  })

  it('shows the deck-entry callout in marketplace mode and enters swipe mode when it is used', async () => {
    renderFeed()
    expect(screen.getByTestId('deck-callout')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /start reviewing/i }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: /deck progress/i })).toBeInTheDocument()
    })
  })

  it('renders the deck-entry callout and the deck in swipe mode', () => {
    renderFeed({ initialMode: 'swipe' })
    expect(screen.getByTestId('deck-callout')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /deck progress/i })).toBeInTheDocument()
    expect(screen.getByTestId('swipe-deck')).toBeInTheDocument()
    expect(screen.queryByTestId('discover-rails')).toBeNull()
  })
})
