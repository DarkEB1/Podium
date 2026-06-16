import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AthletesGrid from './athletes-grid'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

function makeAthlete(overrides: Partial<AthleteRow> = {}): AthleteRow {
  return {
    availability_status: 'available_now',
    available_from_date: null,
    chat_retention_days: null,
    created_at: '2026-01-01T00:00:00.000Z',
    date_of_birth: null,
    discovery_ui_mode: 'standard',
    display_name: 'Jordan Pace',
    display_theme: 'light',
    full_legal_name: null,
    guardian_accepted_at: null,
    guardian_email: null,
    guardian_name: null,
    guardian_phone: null,
    guardian_relationship: null,
    has_agent: false,
    height_cm: null,
    home_city: 'London',
    home_country: 'GB',
    id: 'athlete-1',
    is_under_18: false,
    last_active_at: '2026-06-16T00:00:00.000Z',
    level: 'professional',
    notable_achievements: null,
    notification_prefs: {},
    performance_stats: {},
    phone: null,
    position: null,
    primary_sport: 'Athletics',
    profile_photo_url: 'https://cdn.example.com/jordan.jpg',
    secondary_sport: null,
    seeking: ['sponsorship'],
    social_accounts: { instagram_followers: 25000 },
    status: 'active',
    travel_radius_km: null,
    updated_at: '2026-06-16T00:00:00.000Z',
    user_id: 'user-1',
    weight_kg: null,
    years_active: null,
    ...overrides,
  } as AthleteRow
}

const athletes: AthleteRow[] = [
  makeAthlete({ id: 'a1', user_id: 'u1', display_name: 'Jordan Pace', primary_sport: 'Athletics', level: 'professional', availability_status: 'available_now' }),
  makeAthlete({ id: 'a2', user_id: 'u2', display_name: 'Maya Stone', primary_sport: 'Swimming', level: 'amateur', availability_status: 'not_available', social_accounts: { instagram_followers: 500 } }),
  makeAthlete({ id: 'a3', user_id: 'u3', display_name: 'Theo Wells', primary_sport: 'Athletics', level: 'semi_professional', availability_status: 'available_from' }),
]

describe('AthletesGrid', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }))
  })

  it('renders a card per athlete', () => {
    render(<AthletesGrid athletes={athletes} />)
    expect(screen.getByText('Jordan Pace')).toBeInTheDocument()
    expect(screen.getByText('Maya Stone')).toBeInTheDocument()
    expect(screen.getByText('Theo Wells')).toBeInTheDocument()
  })

  it('filters by sport via the filter panel', async () => {
    const user = userEvent.setup()
    render(<AthletesGrid athletes={athletes} />)
    // sport filter is a labelled control in the panel
    await user.selectOptions(screen.getByLabelText(/sport/i), 'Swimming')
    expect(screen.getByText('Maya Stone')).toBeInTheDocument()
    expect(screen.queryByText('Jordan Pace')).not.toBeInTheDocument()
    expect(screen.queryByText('Theo Wells')).not.toBeInTheDocument()
  })

  it('filters by availability', async () => {
    const user = userEvent.setup()
    render(<AthletesGrid athletes={athletes} />)
    await user.selectOptions(screen.getByLabelText(/availability/i), 'available_now')
    expect(screen.getByText('Jordan Pace')).toBeInTheDocument()
    expect(screen.queryByText('Maya Stone')).not.toBeInTheDocument()
  })

  it('mobile Filters button shows an active-count badge reflecting applied filters', async () => {
    const user = userEvent.setup()
    render(<AthletesGrid athletes={athletes} />)
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    // no count before any filter applied
    expect(within(filtersButton).queryByText(/^[1-9]$/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/sport/i), 'Swimming')
    expect(within(filtersButton).getByText('1')).toBeInTheDocument()
  })

  it('shows an empty state when no athlete matches the filters', async () => {
    const user = userEvent.setup()
    render(<AthletesGrid athletes={athletes} />)
    await user.selectOptions(screen.getByLabelText(/level/i), 'international')
    expect(screen.getByText(/no athletes/i)).toBeInTheDocument()
  })

  it('renders a non-intrusive upgrade banner below the grid for sub-max tiers', () => {
    render(<AthletesGrid athletes={athletes} tier={1} />)
    const banner = screen.getByRole('complementary', { name: /upgrade/i })
    expect(banner).toBeInTheDocument()
    // still shows the grid (non-blocking)
    expect(screen.getByText('Jordan Pace')).toBeInTheDocument()
  })

  it('hides the upgrade banner on the top tier', () => {
    render(<AthletesGrid athletes={athletes} tier={3} />)
    expect(screen.queryByRole('complementary', { name: /upgrade/i })).not.toBeInTheDocument()
  })

  it('passes initial shortlist state down so saved athletes render as saved', () => {
    render(<AthletesGrid athletes={athletes} savedUserIds={['u1']} />)
    expect(screen.getByRole('button', { name: /remove from saved/i })).toBeInTheDocument()
  })
})
