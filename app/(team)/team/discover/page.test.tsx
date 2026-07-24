import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getOwnProfileMock = vi.fn()
const getActiveListingsPageMock = vi.fn()

vi.mock('next/navigation', () => ({
  // Mirror Next.js: redirect() halts rendering by throwing.
  redirect: (...args: unknown[]) => {
    redirectMock(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
}))
vi.mock('@/lib/supabase/auth', () => ({
  getUser: (...args: unknown[]) => getUserMock(...args),
}))
vi.mock('@/lib/supabase/profiles', () => ({
  getOwnProfile: (...args: unknown[]) => getOwnProfileMock(...args),
}))
vi.mock('@/lib/supabase/discovery', () => ({
  LISTING_PAGE_SIZE: 24,
  getActiveListingsPage: (...args: unknown[]) => getActiveListingsPageMock(...args),
}))

import TeamDiscoverPage from './page'

const USER_ID = 'team-user-1'
const TEAM_ID = 'team-profile-1'

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: USER_ID })
  getOwnProfileMock.mockResolvedValue({
    id: TEAM_ID,
    user_id: USER_ID,
    team_name: 'Riverside Rugby Club',
    status: 'active',
    discovery_ui_mode: 'marketplace',
  })
  getActiveListingsPageMock.mockResolvedValue({ listings: [], hasMore: false })
})

async function renderPage(params: Record<string, string> = {}) {
  const ui = await TeamDiscoverPage({ searchParams: Promise.resolve(params) })
  render(ui)
}

describe('TeamDiscoverPage', () => {
  it('redirects unauthenticated users to auth', async () => {
    getUserMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth')
  })

  it('renders a marketplace card per active sponsorship listing', async () => {
    // FA-5: `status = 'active'` is now a WHERE clause, not a JS filter, so the
    // page only ever receives active rows.
    getActiveListingsPageMock.mockResolvedValue({
      listings: [
        { id: 'l1', brand_id: 'brand-1', title: 'Kit Sponsorship', sport_required: 'Rugby', status: 'active', created_at: '2026-01-02' },
        { id: 'l2', brand_id: 'brand-2', title: 'Stadium Naming', sport_required: null, status: 'active', created_at: '2026-01-01' },
      ],
      hasMore: false,
    })

    await renderPage()

    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2)
    expect(screen.getByText('Kit Sponsorship')).toBeInTheDocument()
    expect(screen.getByText('Stadium Naming')).toBeInTheDocument()
  })

  it('asks the database for active listings only', async () => {
    await renderPage()
    expect(getActiveListingsPageMock).toHaveBeenCalledWith(expect.anything(), { limit: 24 })
  })

  it('shows a designed empty state when there are no listings', async () => {
    getActiveListingsPageMock.mockResolvedValue({ listings: [], hasMore: false })
    await renderPage()

    expect(screen.getByText(/no campaigns found/i)).toBeInTheDocument()
  })

  // PR-23: the browse-mode toggle must be on the shipped surface, not just in
  // components/ui with a passing unit test.
  it('renders the browse-mode toggle and switches to the swipe deck', async () => {
    getActiveListingsPageMock.mockResolvedValue({
      listings: [
        { id: 'l1', brand_id: 'brand-1', brand_user_id: 'bu1', title: 'Kit Sponsorship', sport_required: 'Rugby', status: 'active', created_at: '2026-01-02' },
      ],
      hasMore: false,
    })
    await renderPage()

    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /swipe/i }))
    expect(screen.getByTestId('swipe-deck')).toBeInTheDocument()
  })

  it('renders a load-more control when more listings exist', async () => {
    getActiveListingsPageMock.mockResolvedValue({
      listings: [
        { id: 'l1', brand_id: 'brand-1', title: 'Kit Sponsorship', sport_required: 'Rugby', status: 'active', created_at: '2026-01-02' },
      ],
      hasMore: true,
    })
    await renderPage()
    expect(screen.getByRole('link', { name: /load more listings/i }).getAttribute('href')).toBe(
      '/team/discover?show=48'
    )
  })

  // B-4: the cards previously linked to /team/discover/<listingId>, which is
  // not a route, and the empty state linked to /team/profile, which was not
  // one either. Nothing on this surface may point at a missing page.
  it('never links to a listing detail route that does not exist', async () => {
    getActiveListingsPageMock.mockResolvedValue({
      listings: [
        { id: 'l1', brand_id: 'brand-1', title: 'Kit Sponsorship', sport_required: 'Rugby', status: 'active', created_at: '2026-01-02' },
      ],
      hasMore: false,
    })
    await renderPage()

    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^\/team\/discover\//)
    }
  })
})
