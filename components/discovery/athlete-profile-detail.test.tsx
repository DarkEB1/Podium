import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import AthleteProfileDetail from './athlete-profile-detail'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

// Only the columns this presentational component reads are meaningful; the rest
// of the generated row shape is filled in so the type matches.
function athlete(overrides: Partial<AthleteRow> = {}): AthleteRow {
  return {
    display_name: 'Maya Okafor',
    primary_sport: 'Athletics',
    level: 'semi_professional',
    home_city: 'London',
    home_country: 'GB',
    profile_photo_url: null,
    availability_status: 'available_now',
    available_from_date: null,
    travel_radius_km: 50,
    seeking: ['paid_partnership', 'apparel_deal'],
    notable_achievements: null,
    status: 'active',
    ...overrides,
  } as AthleteRow
}

describe('AthleteProfileDetail (PR-3)', () => {
  it('shows the athlete name and headline details', () => {
    render(<AthleteProfileDetail athlete={athlete()} backHref="/brand/discover" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Maya Okafor' })).toBeInTheDocument()
    expect(screen.getByText(/Athletics/)).toBeInTheDocument()
  })

  it('shows what the athlete is looking for', () => {
    render(<AthleteProfileDetail athlete={athlete()} backHref="/brand/discover" />)
    expect(screen.getByText('Paid partnership')).toBeInTheDocument()
    expect(screen.getByText('Apparel deal')).toBeInTheDocument()
  })

  it('says so when the athlete has listed nothing they are looking for', () => {
    render(<AthleteProfileDetail athlete={athlete({ seeking: [] })} backHref="/brand/discover" />)
    expect(screen.getByText(/has not listed the kinds of deals/i)).toBeInTheDocument()
  })

  it('shows availability', () => {
    render(
      <AthleteProfileDetail
        athlete={athlete({ availability_status: 'available_from', available_from_date: '2026-09-01' })}
        backHref="/brand/discover"
      />,
    )
    expect(screen.getByRole('heading', { name: /availability/i })).toBeInTheDocument()
    expect(screen.getByText('50 km')).toBeInTheDocument()
  })

  it('states that an available athlete is open to connection requests', () => {
    render(<AthleteProfileDetail athlete={athlete()} backHref="/brand/discover" />)
    expect(screen.getByTestId('openness')).toHaveTextContent(/open to connection requests/i)
  })

  it('states that an unavailable athlete is only browsing', () => {
    render(
      <AthleteProfileDetail
        athlete={athlete({ availability_status: 'not_available' })}
        backHref="/brand/discover"
      />,
    )
    expect(screen.getByTestId('openness')).toHaveTextContent(/browsing only/i)
  })

  it('links back to the viewer’s discovery surface', () => {
    render(<AthleteProfileDetail athlete={athlete()} backHref="/agent/dashboard" backLabel="Back to clients" />)
    expect(screen.getByRole('link', { name: /back to clients/i })).toHaveAttribute(
      'href',
      '/agent/dashboard',
    )
  })
})
