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

// A "complete" profile: every discoverability field populated so the
// first-run "complete your profile" prompt (DASH5) stays hidden unless a test
// opts into an incomplete row.
function setProfile(status = 'active', overrides: Record<string, unknown> = {}) {
  getOwnProfileMock.mockResolvedValue({
    id: USER_ID,
    display_name: 'Jordan Pace',
    primary_sport: 'Athletics',
    level: 'professional',
    profile_photo_url: 'https://example.com/p.jpg',
    action_photos: ['https://example.com/a.jpg'],
    highlight_videos: ['https://example.com/v.mp4'],
    social_accounts: { instagram: 'jordan' },
    performance_stats: { wins: 3 },
    notable_achievements: 'National champion',
    status,
    ...overrides,
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

    // SectionDivider chips break the page into legible sections. The metric
    // section is honestly titled (DASH2): it holds a sport and a status, not
    // only numbers, so it is "At a glance", not "Your numbers".
    expect(screen.getByText(/at a glance/i)).toBeInTheDocument()
    expect(screen.queryByText(/your numbers/i)).not.toBeInTheDocument()
    expect(screen.getByText(/get going/i)).toBeInTheDocument()
  })

  it('title-cases a lowercase display name in the hero (DASH7)', async () => {
    setProfile('active', { display_name: 'nick dunn' })
    await renderPage()

    // Presentation only — the stored value is untouched.
    expect(
      screen.getByRole('heading', { name: /welcome back, nick dunn/i }),
    ).toHaveTextContent('Welcome back, Nick Dunn')
  })

  it('renders snapshot cards as passive stats, not links (DASH4)', async () => {
    setProfile('active')
    getMatchesMock.mockResolvedValue([{ id: 'm1', status: 'active' }])
    await renderPage()

    // The snapshot tiles read as honest passive stats: the big value is not a
    // link (a link named just "1" is meaningless to a screen reader, and the
    // "Get going" actions below already provide navigation). No stat value
    // should resolve to a link.
    expect(screen.queryByRole('link', { name: '1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /athletics/i })).not.toBeInTheDocument()
    // The value is still shown, just not as an anchor.
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('aligns the quick-action labels to the nav vocabulary (DASH3)', async () => {
    setProfile('active')
    await renderPage()

    expect(screen.getByRole('link', { name: /discover brands/i })).toHaveAttribute(
      'href',
      '/athlete/discover',
    )
    expect(screen.getByRole('link', { name: /^requests$/i })).toHaveAttribute(
      'href',
      '/athlete/requests',
    )
    // No invented vocabulary: the old divergent labels are gone.
    expect(screen.queryByRole('link', { name: /browse brands/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /connection requests/i })).not.toBeInTheDocument()
  })

  it('surfaces a profile-completion prompt for a thin profile (DASH5)', async () => {
    setProfile('active', { profile_photo_url: null, notable_achievements: null })
    await renderPage()

    const cta = screen.getByRole('link', { name: /finish your profile/i })
    expect(cta).toHaveAttribute('href', '/athlete/settings')
    expect(screen.getByText(/complete your profile to get discovered/i)).toBeInTheDocument()
  })

  it('hides the completion prompt once the profile is fleshed out (DASH5)', async () => {
    setProfile('active')
    await renderPage()

    expect(
      screen.queryByRole('link', { name: /finish your profile/i }),
    ).not.toBeInTheDocument()
  })

  it('shows profile status as text, never colour alone', async () => {
    setProfile('pending_review')
    await renderPage()

    expect(screen.getByText(/pending review/i)).toBeInTheDocument()
  })

  it('keeps the primary action links', async () => {
    setProfile('active')
    await renderPage()

    expect(screen.getByRole('link', { name: /discover brands/i })).toHaveAttribute(
      'href',
      '/athlete/discover',
    )
  })
})
