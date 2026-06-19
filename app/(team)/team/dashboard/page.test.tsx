import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getOwnProfileMock = vi.fn()
const getMatchesMock = vi.fn()
const getListingsMock = vi.fn()
const getProposalsMock = vi.fn()

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
vi.mock('@/lib/supabase/messaging', () => ({
  getMatches: (...args: unknown[]) => getMatchesMock(...args),
}))
vi.mock('@/lib/supabase/discovery', () => ({
  getListings: (...args: unknown[]) => getListingsMock(...args),
}))
vi.mock('@/lib/supabase/deals', () => ({
  getProposals: (...args: unknown[]) => getProposalsMock(...args),
}))

import TeamDashboardPage from './page'

const USER_ID = 'team-user-1'
const TEAM_ID = 'team-profile-1'

function setProfile(status = 'active') {
  getOwnProfileMock.mockResolvedValue({
    id: TEAM_ID,
    user_id: USER_ID,
    team_name: 'Riverside Rugby Club',
    nickname: null,
    status,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: USER_ID })
  getMatchesMock.mockResolvedValue([])
  getListingsMock.mockResolvedValue([])
  getProposalsMock.mockResolvedValue([])
})

async function renderPage() {
  const ui = await TeamDashboardPage()
  render(ui)
}

describe('TeamDashboardPage', () => {
  it('redirects to onboarding when the team has no profile', async () => {
    getOwnProfileMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/team/onboarding')
  })

  it('renders the four headline metrics in the StatStrip', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([
      { id: 'm1', status: 'active' },
      { id: 'm2', status: 'active' },
    ])
    getListingsMock.mockResolvedValue([
      { id: 'l1', brand_id: TEAM_ID, status: 'active' },
      { id: 'l2', brand_id: TEAM_ID, status: 'paused' },
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
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('shows a designed empty state with a discover CTA when active with no activity', async () => {
    setProfile('active')
    await renderPage()

    expect(screen.getByTestId('team-dashboard-empty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find sponsors/i })).toHaveAttribute(
      'href',
      '/team/discover',
    )
  })

  it('hides the activity empty state once the team has matches', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([{ id: 'm1', status: 'active' }])
    await renderPage()

    expect(screen.queryByTestId('team-dashboard-empty')).not.toBeInTheDocument()
  })

  it('prompts to finish onboarding when the profile is not yet active', async () => {
    setProfile('pending_review')
    await renderPage()

    expect(screen.getByText(/under review/i)).toBeInTheDocument()
  })
})
