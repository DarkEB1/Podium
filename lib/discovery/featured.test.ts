import { describe, it, expect } from 'vitest'
import { decorateWithPremium, isListingInArea } from './featured'
import type { ScoredListing } from './match'

const base: ScoredListing = {
  id: '1',
  brand_id: 'bp1',
  title: 'X',
  description: null,
  type: 'athlete_endorsement',
  status: 'active',
  sport_required: 'Surfing',
  level_required: null,
  location: 'London',
  is_remote: false,
  pay_type: 'flat_fee',
  pay_amount: 100,
  pay_currency: 'GBP',
  contract_duration_months: null,
  application_deadline: null,
  created_at: '2026-01-01T00:00:00Z',
  brand_user_id: 'b',
  brand_name: 'B',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: null,
  matchScore: 50,
  matchReasons: [],
}

describe('isListingInArea', () => {
  const athlete = { home_city: 'London', home_country: 'United Kingdom' }

  it('matches the athlete home city, case-insensitively and inside longer strings', () => {
    expect(isListingInArea({ location: 'london', is_remote: false }, athlete)).toBe(true)
    expect(isListingInArea({ location: 'East London, UK', is_remote: false }, athlete)).toBe(true)
  })

  it('falls back to the home country', () => {
    expect(isListingInArea({ location: 'Manchester, United Kingdom', is_remote: false }, athlete)).toBe(true)
    expect(isListingInArea({ location: 'Paris, France', is_remote: false }, athlete)).toBe(false)
  })

  it('never treats remote or location-less listings as in-area', () => {
    expect(isListingInArea({ location: 'London', is_remote: true }, athlete)).toBe(false)
    expect(isListingInArea({ location: null, is_remote: false }, athlete)).toBe(false)
    expect(isListingInArea({ location: '', is_remote: false }, athlete)).toBe(false)
  })

  it('is false without an athlete profile or with no home location', () => {
    expect(isListingInArea({ location: 'London', is_remote: false }, null)).toBe(false)
    expect(isListingInArea({ location: 'London', is_remote: false }, { home_city: null, home_country: null })).toBe(false)
  })
})

describe('decorateWithPremium', () => {
  const athlete = { home_city: 'London', home_country: 'United Kingdom' }

  it('marks premium brands verified and, when in the athlete area, featured', () => {
    const [inArea, elsewhere, remote, ordinary] = decorateWithPremium(
      [
        base,
        { ...base, id: '2', location: 'Berlin' },
        { ...base, id: '3', is_remote: true },
        { ...base, id: '4', brand_user_id: 'other' },
      ],
      new Set(['b']),
      athlete
    )
    expect(inArea).toMatchObject({ brandVerified: true, featured: true })
    expect(elsewhere).toMatchObject({ brandVerified: true, featured: false })
    expect(remote).toMatchObject({ brandVerified: true, featured: false })
    expect(ordinary).toMatchObject({ brandVerified: false, featured: false })
  })

  it('handles a null brand_user_id and no athlete', () => {
    const [row] = decorateWithPremium([{ ...base, brand_user_id: null }], new Set(['b']), null)
    expect(row).toMatchObject({ brandVerified: false, featured: false })
  })

  it('keeps every other field intact', () => {
    const [row] = decorateWithPremium([base], new Set(), athlete)
    expect(row).toMatchObject({ ...base, brandVerified: false, featured: false })
  })
})
