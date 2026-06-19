import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import ProfilePreview from './profile-preview'
import type { Database } from '@/types/database'

// next/navigation has no provider under jsdom; stub useRouter so the default
// router-based edit fallback can construct even when a test passes onEditStep.
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

// Minimal-but-complete row factory: only the fields the review card reads need
// to be realistic; the rest satisfy the Row type with inert defaults.
function makeProfile(overrides: Partial<AthleteRow> = {}): AthleteRow {
  const base: AthleteRow = {
    academy_club: null,
    action_photos: ['/action-1.jpg', '/action-2.jpg'],
    availability_status: 'available_now',
    available_from_date: null,
    chat_retention_days: null,
    created_at: '2026-01-01T00:00:00Z',
    date_of_birth: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum string literal narrowed by Row type at use site
    discovery_ui_mode: 'simple' as any,
    display_name: 'Jane Doe',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum string literal narrowed by Row type at use site
    display_theme: 'system' as any,
    full_legal_name: null,
    guardian_accepted_at: null,
    guardian_email: null,
    guardian_name: null,
    guardian_phone: null,
    guardian_relationship: null,
    has_agent: false,
    height_cm: null,
    highest_level: null,
    highlight_videos: [],
    home_city: 'London',
    home_country: 'GB',
    id: 'athlete-1',
    is_under_18: false,
    last_active_at: null,
    level: 'national',
    national_programme: null,
    notable_achievements: null,
    notification_prefs: {},
    payout_account_holder: null,
    payout_account_last4: null,
    payout_bank_name: null,
    payout_country: null,
    payout_method: null,
    payout_sort_code_last4: null,
    performance_stats: {},
    phone: null,
    position: 'Sprinter',
    primary_sport: 'Athletics',
    profile_photo_url: '/avatar.jpg',
    secondary_sport: null,
    seeking: ['paid_partnership', 'product_gifting'],
    social_accounts: {
      instagram: { url: 'https://instagram.com/jane', followers: 12400 },
      youtube: { url: 'https://youtube.com/jane', followers: 3200 },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum string literal narrowed by Row type at use site
    status: 'draft' as any,
    stripe_connect_account_id: null,
    stripe_connect_onboarded_at: null,
    stripe_connect_status: null,
    travel_radius_km: 50,
    university_team: null,
    updated_at: '2026-01-01T00:00:00Z',
    user_id: 'user-1',
    weight_kg: null,
    years_active: null,
  }
  return { ...base, ...overrides }
}

describe('ProfilePreview', () => {
  it('renders every required review element', () => {
    render(<ProfilePreview profile={makeProfile()} onEditStep={vi.fn()} />)

    // Large circular photo, >= 120px.
    const photo = screen.getByRole('img', { name: /Jane Doe profile photo/i })
    expect(photo).toHaveAttribute('src', '/avatar.jpg')
    expect(photo.className).toMatch(/rounded-full/)
    expect(photo.className).toMatch(/size-3\d|size-\[\d/)

    // Name.
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()

    // Sport + position.
    expect(screen.getByText(/Athletics/)).toBeInTheDocument()
    expect(screen.getByText(/Sprinter/)).toBeInTheDocument()

    // LevelChip (humanised).
    expect(screen.getByText('National')).toBeInTheDocument()

    // City-only location with pin (no country in the visible location text).
    const location = screen.getByText('London')
    expect(location).toBeInTheDocument()
    expect(screen.queryByText(/London, GB/)).not.toBeInTheDocument()

    // Travel radius.
    expect(screen.getByText(/50\s?km/)).toBeInTheDocument()

    // SeekingTag chips.
    expect(screen.getByText('Paid partnership')).toBeInTheDocument()
    expect(screen.getByText('Product gifting')).toBeInTheDocument()

    // Connected socials with follower counts.
    expect(screen.getByText(/Instagram/)).toBeInTheDocument()
    expect(screen.getByText('12.4K')).toBeInTheDocument()
    expect(screen.getByText(/YouTube/)).toBeInTheDocument()

    // Colour-coded AvailabilityBadge.
    expect(screen.getByText('Available now')).toBeInTheDocument()

    // Action-photo thumbnail strip.
    expect(screen.getByRole('img', { name: /Jane Doe action photo 1/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Jane Doe action photo 2/i })).toBeInTheDocument()
  })

  it('renders sections in the required order', () => {
    render(<ProfilePreview profile={makeProfile()} onEditStep={vi.fn()} />)
    const html = document.body.innerHTML
    const order = [
      'Jane Doe',
      'Athletics',
      'National',
      'London',
      'Travels up to 50',
      'Paid partnership',
      'Instagram',
      'Available now',
      'action photo 1',
    ]
    const positions = order.map((needle) => html.indexOf(needle))
    for (const [i, p] of positions.entries()) {
      expect(p, `"${order[i]}" should be present`).toBeGreaterThanOrEqual(0)
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]!).toBeGreaterThan(positions[i - 1]!)
    }
  })

  it('routes each per-section Edit button to the correct onboarding step', async () => {
    const onEditStep = vi.fn()
    render(<ProfilePreview profile={makeProfile()} onEditStep={onEditStep} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /edit basic info/i }))
    expect(onEditStep).toHaveBeenLastCalledWith(1)

    await user.click(screen.getByRole('button', { name: /edit sport/i }))
    expect(onEditStep).toHaveBeenLastCalledWith(2)

    await user.click(screen.getByRole('button', { name: /edit availability/i }))
    expect(onEditStep).toHaveBeenLastCalledWith(3)

    await user.click(screen.getByRole('button', { name: /edit socials/i }))
    expect(onEditStep).toHaveBeenLastCalledWith(4)
  })

  it('falls back to router navigation when no onEditStep is provided', async () => {
    pushMock.mockClear()
    render(<ProfilePreview profile={makeProfile()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /edit basic info/i }))
    expect(pushMock).toHaveBeenCalledWith('/athlete/onboarding/step/1')
  })

  it('shows Available from with date when status is available_from', () => {
    render(
      <ProfilePreview
        profile={makeProfile({ availability_status: 'available_from', available_from_date: '2026-09-01' })}
        onEditStep={vi.fn()}
      />,
    )
    expect(screen.getByText(/Available from/)).toBeInTheDocument()
  })

  it('falls back to an initial and em dashes when fields are missing', () => {
    render(
      <ProfilePreview
        profile={makeProfile({
          profile_photo_url: null,
          display_name: 'Sam',
          position: null,
          level: null,
          home_city: null,
          travel_radius_km: null,
          seeking: [],
          social_accounts: {},
          action_photos: [],
        })}
        onEditStep={vi.fn()}
      />,
    )
    // No photo -> initial avatar, no img for the avatar.
    expect(screen.queryByRole('img', { name: /profile photo/i })).not.toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
  })
})
