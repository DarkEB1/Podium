import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getOwnProfileMock = vi.fn()
const getSubscriptionForUserMock = vi.fn()
const getMatchesMock = vi.fn()
const getListingsMock = vi.fn()
const getProposalsMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
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
vi.mock('@/lib/supabase/payments', () => ({
  getSubscriptionForUser: (...args: unknown[]) => getSubscriptionForUserMock(...args),
}))
vi.mock('@/lib/supabase/messaging', () => ({
  getMatches: (...args: unknown[]) => getMatchesMock(...args),
}))
vi.mock('@/lib/supabase/discovery', () => ({
  getListings: (...args: unknown[]) => getListingsMock(...args),
}))
vi.mock('@/lib/supabase/deals', () => ({
  getProposals: (...args: unknown[]) => getProposalsMock(...args),
}))

import BrandDashboardPage from './page'

const USER_ID = 'brand-user-1'

function setProfile(status = 'active') {
  getOwnProfileMock.mockResolvedValue({
    id: USER_ID,
    company_name: 'Acme Sports',
    trading_name: null,
    status,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: USER_ID })
  getSubscriptionForUserMock.mockResolvedValue({ status: 'active', tier: 1 })
  getMatchesMock.mockResolvedValue([])
  getListingsMock.mockResolvedValue([])
  getProposalsMock.mockResolvedValue([])
})

async function renderPage() {
  const ui = await BrandDashboardPage()
  render(ui)
}

describe('BrandDashboardPage', () => {
  it('renders the four headline metrics in the StatStrip', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([
      { id: 'm1', status: 'active' },
      { id: 'm2', status: 'active' },
    ])
    getListingsMock.mockResolvedValue([
      { id: 'l1', brand_id: USER_ID, status: 'active' },
      { id: 'l2', brand_id: USER_ID, status: 'paused' },
      { id: 'l3', brand_id: 'other', status: 'active' },
    ])
    getProposalsMock.mockImplementation(async (_sb: unknown, matchId: string) =>
      matchId === 'm1'
        ? [
            { id: 'p1', sender_id: USER_ID, status: 'accepted' },
            { id: 'p2', sender_id: USER_ID, status: 'pending' },
          ]
        : [{ id: 'p3', sender_id: 'someone-else', status: 'pending' }],
    )

    await renderPage()

    expect(screen.getByText('Active Listings')).toBeInTheDocument()
    expect(screen.getByText('Total Matches')).toBeInTheDocument()
    expect(screen.getByText('Proposals Sent')).toBeInTheDocument()
    expect(screen.getByText('Deals Closed')).toBeInTheDocument()
    // Active Listings = 1, Total Matches = 2, Proposals Sent = 2, Deals Closed = 1
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('shows a designed empty state with a discover CTA when active with no activity', async () => {
    setProfile('active')
    await renderPage()

    expect(screen.getByTestId('brand-dashboard-empty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /discover athletes/i })).toHaveAttribute(
      'href',
      '/brand/discover',
    )
  })

  it('hides the activity empty state once the brand has matches', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([{ id: 'm1', status: 'active' }])
    await renderPage()

    expect(screen.queryByTestId('brand-dashboard-empty')).not.toBeInTheDocument()
  })

  it('prompts to choose a plan when there is no active subscription', async () => {
    setProfile('pending_approval')
    getSubscriptionForUserMock.mockResolvedValue(null)
    await renderPage()

    expect(screen.getByRole('link', { name: /choose a plan/i })).toHaveAttribute(
      'href',
      '/brand/subscription',
    )
  })
})
