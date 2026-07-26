import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getPageMock = vi.fn()
const getShortlistMock = vi.fn()
const getSubscriptionMock = vi.fn()
const getDiscoveryUiModeMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/supabase/auth', () => ({ getUser: (...a: unknown[]) => getUserMock(...a) }))
vi.mock('@/lib/supabase/profiles', () => ({
  ATHLETE_PAGE_SIZE: 24,
  getActiveAthleteProfilesPage: (...a: unknown[]) => getPageMock(...a),
  getDiscoveryUiMode: (...a: unknown[]) => getDiscoveryUiModeMock(...a),
}))
vi.mock('@/lib/supabase/discovery', () => ({
  getShortlist: (...a: unknown[]) => getShortlistMock(...a),
}))
vi.mock('@/lib/supabase/payments', () => ({
  getSubscriptionForUser: (...a: unknown[]) => getSubscriptionMock(...a),
}))

import BrandDiscoverPage from './page'

const athlete = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  user_id: 'athlete-user-1',
  display_name: 'Jordan Ellis',
  primary_sport: 'Football',
  secondary_sport: null,
  level: 'semi_professional',
  position: null,
  home_city: 'Leeds',
  home_country: 'UK',
  travel_radius_km: 50,
  availability_status: 'available_now',
  available_from_date: null,
  profile_photo_url: null,
  social_accounts: null,
  last_active_at: null,
  updated_at: '2026-01-01',
  created_at: '2026-01-01',
  status: 'active',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: 'brand-user-1' })
  getPageMock.mockResolvedValue({ athletes: [athlete()], hasMore: false })
  getShortlistMock.mockResolvedValue([])
  getSubscriptionMock.mockResolvedValue(null)
  getDiscoveryUiModeMock.mockResolvedValue('marketplace')
})

async function renderPage(params: Record<string, string> = {}) {
  render(await BrandDiscoverPage({ searchParams: Promise.resolve(params) }))
}

describe('BrandDiscoverPage', () => {
  it('redirects unauthenticated users to auth', async () => {
    getUserMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth')
  })

  // PR-23
  it('renders the browse-mode toggle and switches to the swipe deck', async () => {
    await renderPage()
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    expect(screen.getByText('Jordan Ellis')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /swipe/i }))
    expect(screen.getByTestId('swipe-deck')).toBeInTheDocument()
  })

  it('starts in the mode persisted on the profile', async () => {
    getDiscoveryUiModeMock.mockResolvedValue('swipe')
    await renderPage()
    expect(screen.getByTestId('swipe-card')).toBeInTheDocument()
  })

  // FA-5 / SB-9
  it('fetches one bounded page rather than every athlete', async () => {
    await renderPage()
    expect(getPageMock).toHaveBeenCalledWith(expect.anything(), { limit: 24 })
    expect(screen.queryByTestId('load-more')).toBeNull()
  })

  it('offers a load-more control when more athletes exist', async () => {
    getPageMock.mockResolvedValue({ athletes: [athlete()], hasMore: true })
    await renderPage({ show: '48' })
    expect(getPageMock).toHaveBeenCalledWith(expect.anything(), { limit: 48 })
    expect(screen.getByRole('link', { name: /load more athletes/i }).getAttribute('href')).toBe(
      '/brand/discover?show=72'
    )
  })

  it('never offers a verified-athletes filter, which no column can back', async () => {
    await renderPage()
    expect(screen.queryByLabelText(/verified athletes only/i)).toBeNull()
  })
})
