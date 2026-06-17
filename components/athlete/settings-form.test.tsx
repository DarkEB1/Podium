import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsForm from './settings-form'
import type { Database } from '@/types/database'

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
// Provide minimal shims so switch clicks dispatch in tests.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {} as unknown
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SettingsRow = Database['public']['Tables']['profile_settings']['Row']

// updateSettings (B9) is the persistence path for the Visibility & Discovery
// section. We assert the component calls it rather than hitting the DB.
const updateSettingsMock = vi.fn()
vi.mock('@/lib/supabase/settings', () => ({
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ __browser: true }),
}))

const makeProfile = (overrides: Partial<AthleteRow> = {}): AthleteRow => ({
  id: 'p1',
  user_id: 'u1',
  display_name: 'James',
  full_legal_name: null,
  date_of_birth: null,
  phone: null,
  home_city: 'London',
  home_country: 'UK',
  primary_sport: 'Football',
  secondary_sport: null,
  level: 'amateur',
  position: null,
  years_active: null,
  height_cm: null,
  weight_kg: null,
  availability_status: 'available_now',
  available_from_date: null,
  travel_radius_km: 50,
  seeking: ['paid_partnership'],
  social_accounts: {},
  notable_achievements: null,
  is_under_18: false,
  has_agent: false,
  guardian_name: null,
  guardian_relationship: null,
  guardian_email: null,
  guardian_phone: null,
  guardian_accepted_at: null,
  profile_photo_url: null,
  notification_prefs: {},
  performance_stats: {},
  discovery_ui_mode: 'marketplace',
  display_theme: 'light',
  status: 'active',
  last_active_at: null,
  chat_retention_days: null,
  academy_club: null,
  action_photos: [],
  highest_level: null,
  highlight_videos: [],
  national_programme: null,
  university_team: null,
  payout_account_holder: null,
  payout_account_last4: null,
  payout_bank_name: null,
  payout_country: null,
  payout_method: null,
  payout_sort_code_last4: null,
  stripe_connect_account_id: null,
  stripe_connect_onboarded_at: null,
  stripe_connect_status: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
})

const makeSettings = (overrides: Partial<SettingsRow> = {}): SettingsRow => ({
  id: 's1',
  user_id: 'u1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  discoverable: true,
  profile_visible: true,
  pause_matches: false,
  display_currency: 'gbp',
  email_digest: 'weekly',
  location_precision: 'city',
  marketing_opt_in: false,
  notification_matrix: {},
  quiet_hours_start: null,
  quiet_hours_end: null,
  section_visibility: {},
  ...overrides,
})

describe('SettingsForm', () => {
  beforeEach(() => {
    updateSettingsMock.mockReset()
    updateSettingsMock.mockResolvedValue(makeSettings())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeProfile() }),
    )
  })

  // --- Section 1: Profile ---

  it('renders the two settings sections in a shell', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByRole('navigation', { name: /settings sections/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /visibility & discovery/i }),
    ).toBeInTheDocument()
  })

  it('renders display name field pre-populated', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByDisplayValue('James')).toBeInTheDocument()
  })

  it('shows a profile-completeness meter with a prompt for missing fields', () => {
    render(
      <SettingsForm
        profile={makeProfile({ profile_photo_url: null, notable_achievements: null })}
        settings={makeSettings()}
      />,
    )
    const meter = screen.getByRole('progressbar', { name: /profile completeness/i })
    expect(meter).toBeInTheDocument()
    // a prompt nudging the user to add the missing photo
    expect(screen.getByText(/add a profile photo/i)).toBeInTheDocument()
  })

  it('saves Section 1 profile fields via PATCH /api/profiles/me', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    await userEvent.clear(screen.getByLabelText(/display name/i))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Jimmy')
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/profiles/me',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  // --- Section 2: Visibility & Discovery ---

  it('shows an explanation under the visibility toggle', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByText(/visible in discovery/i)).toBeInTheDocument()
  })

  it('persists the visibility toggle via updateSettings (B9)', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings({ profile_visible: true })} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const toggle = within(region).getByRole('switch', { name: /profile visible/i })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({ profile_visible: false }),
      ),
    )
  })

  it('persists the pause-matches toggle via updateSettings (B9)', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings({ pause_matches: false })} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const toggle = within(region).getByRole('switch', { name: /pause matches/i })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({ pause_matches: true }),
      ),
    )
  })

  it('saves discovery profile fields (travel radius / mode) via PATCH /api/profiles/me', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    await userEvent.click(screen.getByRole('button', { name: /save discovery/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/profiles/me',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  it('reveals an availability date picker only when "Available From" is chosen', async () => {
    render(
      <SettingsForm
        profile={makeProfile({ availability_status: 'available_now' })}
        settings={makeSettings()}
      />,
    )
    expect(screen.queryByLabelText(/available from date/i)).not.toBeInTheDocument()
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const availabilitySelect = within(region).getByLabelText(/availability/i)
    await userEvent.selectOptions(availabilitySelect, 'available_from')
    expect(screen.getByLabelText(/available from date/i)).toBeInTheDocument()
  })
})
