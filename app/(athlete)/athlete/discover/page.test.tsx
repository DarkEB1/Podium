import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getActiveListingsPageMock = vi.fn()
const getDiscoveryUiModeMock = vi.fn()

vi.mock('next/navigation', () => ({
  // Mirror Next.js: redirect() halts rendering by throwing.
  redirect: (...args: unknown[]) => {
    redirectMock(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUserMock(...a) }))
vi.mock('@/lib/supabase/discovery', () => ({
  LISTING_PAGE_SIZE: 24,
  getActiveListingsPage: (...a: unknown[]) => getActiveListingsPageMock(...a),
}))
vi.mock('@/lib/supabase/profiles', () => ({
  getDiscoveryUiMode: (...a: unknown[]) => getDiscoveryUiModeMock(...a),
  // The page now fetches the athlete profile to rank listings by match (spec §10).
  getOwnProfile: vi.fn(async () => ({ primary_sport: 'Football', level: 'amateur' })),
}))

import AthleteDiscoverPage from './page'

const listing = (over: Record<string, unknown> = {}) => ({
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

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: 'athlete-1' })
  getDiscoveryUiModeMock.mockResolvedValue('marketplace')
  getActiveListingsPageMock.mockResolvedValue({ listings: [listing()], hasMore: false })
})

async function renderPage(params: Record<string, string> = {}) {
  render(await AthleteDiscoverPage({ searchParams: Promise.resolve(params) }))
}

describe('AthleteDiscoverPage', () => {
  it('redirects unauthenticated users to auth', async () => {
    getUserMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth')
  })

  // PR-23: the toggle was built, unit-tested and imported by nothing. This is
  // the assertion that fails if it is ever unwired again.
  it('renders the browse-mode toggle on the page', async () => {
    await renderPage()
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /grid/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /swipe/i })).toBeInTheDocument()
  })

  it('leads the masthead with the athlete primary sport when one is known', async () => {
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: /ranked for you, football/i })
    ).toBeInTheDocument()
  })

  it('renders the made-for-you rails in marketplace mode', async () => {
    await renderPage()
    expect(screen.getByTestId('discover-rails')).toBeInTheDocument()
    // buildRails always emits a "Top matches" rail for a non-empty page.
    expect(screen.getByRole('region', { name: /top matches/i })).toBeInTheDocument()
  })

  it('starts in the mode persisted on the profile', async () => {
    getDiscoveryUiModeMock.mockResolvedValue('swipe')
    await renderPage()
    expect(screen.getByTestId('swipe-deck')).toBeInTheDocument()
    expect(screen.queryByTestId('discover-rails')).toBeNull()
  })

  it('switches from the rails to the swipe deck when the toggle is used', async () => {
    await renderPage()
    expect(screen.getByTestId('discover-rails')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /swipe/i }))
    expect(screen.getByTestId('swipe-deck')).toBeInTheDocument()
    expect(screen.queryByTestId('discover-rails')).toBeNull()
  })

  // FA-5
  it('requests one bounded page and shows no load-more when there is nothing more', async () => {
    await renderPage()
    expect(getActiveListingsPageMock).toHaveBeenCalledWith(expect.anything(), {
      limit: 24,
      type: 'athlete_endorsement',
    })
    expect(screen.queryByTestId('load-more')).toBeNull()
  })

  it('renders a load-more link to the next page when more rows exist', async () => {
    getActiveListingsPageMock.mockResolvedValue({ listings: [listing()], hasMore: true })
    await renderPage()
    const link = screen.getByRole('link', { name: /load more campaigns/i })
    expect(link.getAttribute('href')).toBe('/athlete/discover?show=48')
  })

  it('honours the ?show= parameter so load-more actually loads more', async () => {
    getActiveListingsPageMock.mockResolvedValue({ listings: [listing()], hasMore: true })
    await renderPage({ show: '48' })
    expect(getActiveListingsPageMock).toHaveBeenCalledWith(expect.anything(), {
      limit: 48,
      type: 'athlete_endorsement',
    })
    expect(screen.getByRole('link', { name: /load more campaigns/i }).getAttribute('href')).toBe(
      '/athlete/discover?show=72'
    )
  })
})
