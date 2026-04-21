import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsForm from './settings-form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const makeProfile = (): AthleteRow => ({
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
  travel_radius_km: null,
  seeking: [],
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
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
})

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeProfile(),
    }))
  })

  it('renders display name field pre-populated', () => {
    render(<SettingsForm profile={makeProfile()} />)
    expect(screen.getByDisplayValue('James')).toBeInTheDocument()
  })

  it('calls PATCH /api/profiles/me on save', async () => {
    render(<SettingsForm profile={makeProfile()} />)
    await userEvent.clear(screen.getByLabelText(/display name/i))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Jimmy')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
