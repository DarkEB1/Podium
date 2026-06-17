import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const getUserMock = vi.fn()
const getOwnProfileMock = vi.fn()
const getMatchesMock = vi.fn()

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

import AthleteDashboardPage from './page'

const USER_ID = 'athlete-user-1'

function setProfile(status = 'active') {
  getOwnProfileMock.mockResolvedValue({
    id: USER_ID,
    display_name: 'Jordan Pace',
    primary_sport: 'Athletics',
    status,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ id: USER_ID })
  getMatchesMock.mockResolvedValue([])
})

async function renderPage() {
  const ui = await AthleteDashboardPage()
  render(ui)
}

describe('AthleteDashboardPage', () => {
  it('redirects to onboarding when the athlete has no profile', async () => {
    getOwnProfileMock.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/athlete/onboarding')
  })

  it('renders the welcome as an AccentHeading', async () => {
    setProfile('active')
    await renderPage()

    const heading = screen.getByRole('heading', { name: /welcome back, jordan pace/i })
    expect(heading).toHaveAttribute('data-slot', 'accent-heading')
  })

  it('renders the headline metrics in a StatStrip with section dividers', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([
      { id: 'm1', status: 'active' },
      { id: 'm2', status: 'active' },
      { id: 'm3', status: 'closed' },
    ])
    await renderPage()

    // StatStrip renders a semantic list of metric tiles.
    expect(screen.getByText('Active conversations')).toBeInTheDocument()
    expect(screen.getByText('Sport')).toBeInTheDocument()
    expect(screen.getByText('Profile status')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    // Active conversations counts only active matches.
    expect(screen.getByText('2')).toBeInTheDocument()

    // SectionDivider chips break the page into legible sections.
    expect(screen.getByText(/your numbers/i)).toBeInTheDocument()
    expect(screen.getByText(/get going/i)).toBeInTheDocument()
  })

  it('shows profile status as text, never colour alone', async () => {
    setProfile('pending_review')
    await renderPage()

    expect(screen.getByText(/pending review/i)).toBeInTheDocument()
  })

  it('keeps the primary action links', async () => {
    setProfile('active')
    await renderPage()

    expect(screen.getByRole('link', { name: /browse brands/i })).toHaveAttribute(
      'href',
      '/athlete/discover',
    )
  })
})
