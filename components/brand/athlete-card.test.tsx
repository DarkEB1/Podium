import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AthleteCard from './athlete-card'
import type { Database } from '@/types/database'
import { copy } from '@/lib/copy'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

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

describe('AthleteCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    toastSuccess.mockClear()
    toastError.mockClear()
  })

  it('renders name, sport and a single primary CTA (no inline message form)', () => {
    render(<AthleteCard athlete={makeAthlete()} />)
    expect(screen.getByText('Jordan Pace')).toBeInTheDocument()
    expect(screen.getByText(/athletics/i)).toBeInTheDocument()
    // single CTA — view profile, not a connect/send-request flow
    expect(screen.getByRole('link', { name: /view profile/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/introduce your brand/i)).not.toBeInTheDocument()
  })

  it('shows the Verified badge when verified', () => {
    render(<AthleteCard athlete={makeAthlete()} verified />)
    expect(screen.getByText(/verified/i)).toBeInTheDocument()
  })

  it('shows a colour-coded availability pill with an icon and label', () => {
    render(<AthleteCard athlete={makeAthlete({ availability_status: 'available_now' })} />)
    expect(screen.getByText(/available now/i)).toBeInTheDocument()
  })

  it('shows "Responds quickly" when recently active (<24h)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T10:00:00.000Z'))
    render(
      <AthleteCard
        athlete={makeAthlete({ last_active_at: '2026-06-16T01:00:00.000Z' })}
      />
    )
    expect(screen.getByText(/responds quickly/i)).toBeInTheDocument()
  })

  it('hides "Responds quickly" when last active over 24h ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T10:00:00.000Z'))
    render(
      <AthleteCard
        athlete={makeAthlete({ last_active_at: '2026-06-10T01:00:00.000Z' })}
      />
    )
    expect(screen.queryByText(/responds quickly/i)).not.toBeInTheDocument()
  })

  it('shortlists via the shortlist API (no connection request sent)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<AthleteCard athlete={makeAthlete()} />)
    await user.click(screen.getByRole('button', { name: /add to saved/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/discovery/shortlist')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ target_user_id: 'user-1' })
    // the toggle reflects the saved state
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /remove from saved/i })).toBeInTheDocument()
    )
    // confirms with the energetic Podium shortlist toast copy
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(copy.toasts.saved))
  })

  it('removes from the shortlist when toggled off (DELETE, not a request)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<AthleteCard athlete={makeAthlete()} initialSaved />)
    await user.click(screen.getByRole('button', { name: /remove from saved/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/discovery/shortlist/user-1')
    expect(init.method).toBe('DELETE')
  })
})
