import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getOwnProfileMock = vi.fn()
const getListingsMock = vi.fn()

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
  getListings: (...args: unknown[]) => getListingsMock(...args),
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
  })
  getListingsMock.mockResolvedValue([])
})

async function renderPage() {
  const ui = await TeamDiscoverPage()
  render(ui)
}

describe('TeamDiscoverPage', () => {
  it('redirects unauthenticated users to auth', async () => {
    getUserMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth')
  })

  it('renders a marketplace card per active sponsorship listing', async () => {
    getListingsMock.mockResolvedValue([
      {
        id: 'l1',
        brand_id: 'brand-1',
        title: 'Kit Sponsorship',
        sport_required: 'Rugby',
        status: 'active',
      },
      {
        id: 'l2',
        brand_id: 'brand-2',
        title: 'Stadium Naming',
        sport_required: null,
        status: 'active',
      },
      {
        id: 'l3',
        brand_id: 'brand-3',
        title: 'Draft listing',
        sport_required: null,
        status: 'draft',
      },
    ])

    await renderPage()

    // Only the two active listings surface in the team's discovery feed.
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2)
    expect(screen.getByText('Kit Sponsorship')).toBeInTheDocument()
    expect(screen.getByText('Stadium Naming')).toBeInTheDocument()
    expect(screen.queryByText('Draft listing')).not.toBeInTheDocument()
  })

  it('shows a designed empty state when there are no listings', async () => {
    getListingsMock.mockResolvedValue([])
    await renderPage()

    expect(screen.getByTestId('team-discover-empty')).toBeInTheDocument()
  })
})
