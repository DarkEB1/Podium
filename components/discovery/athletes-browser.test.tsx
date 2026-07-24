import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import AthletesBrowser from './athletes-browser'
import type { AthleteSummary } from '@/lib/supabase/profiles'

const athlete = (over: Partial<AthleteSummary> = {}): AthleteSummary =>
  ({
    id: 'a1',
    user_id: 'athlete-user-1',
    display_name: 'Jordan Ellis',
    primary_sport: 'Football',
    secondary_sport: null,
    level: 'semi_professional',
    position: null,
    home_city: 'Leeds',
    home_country: 'UK',
    travel_radius_km: 50,
    availability_status: 'available_now',
    available_from_date: null,
    profile_photo_url: null,
    social_accounts: null,
    last_active_at: null,
    updated_at: '2026-01-01',
    created_at: '2026-01-01',
    status: 'active',
    ...over,
  }) as AthleteSummary

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AthletesBrowser', () => {
  it('renders the toggle above the athletes grid', () => {
    render(<AthletesBrowser athletes={[athlete()]} initialMode="marketplace" />)
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    expect(screen.getByText('Jordan Ellis')).toBeInTheDocument()
  })

  // PR-23: the swipe's "interested" is the same shortlist mutation the grid
  // bookmark performs (components/brand/athlete-card.tsx).
  it('swiping interested POSTs to the shortlist API', async () => {
    render(<AthletesBrowser athletes={[athlete()]} initialMode="swipe" />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/discovery/shortlist')
      expect(call).toBeDefined()
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        target_user_id: 'athlete-user-1',
      })
    })
  })

  it('persists the browse mode to the profile column', async () => {
    render(<AthletesBrowser athletes={[athlete()]} initialMode="marketplace" />)
    await userEvent.click(screen.getByRole('radio', { name: /swipe/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/profiles/me')
      expect(call).toBeDefined()
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        discovery_ui_mode: 'swipe',
      })
    })
  })
})
