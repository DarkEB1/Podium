import { describe, it, expect } from 'vitest'
import {
  scoreAthleteForListing,
  bestListingMatch,
  sortListingsByMatch,
  type MatchAthlete,
  type MatchListing,
} from './score'

const athlete: MatchAthlete = {
  primary_sport: 'Football',
  secondary_sport: 'Futsal',
  level: 'semi_professional',
  home_city: 'Leeds',
  home_country: 'UK',
  availability_status: 'available_now',
  social_accounts: { instagram_followers: 150_000 },
}

describe('scoreAthleteForListing', () => {
  it('scores a perfect fit at or near 100', () => {
    const listing: MatchListing = {
      sport_required: 'Football',
      level_required: 'semi_professional',
      location: 'Leeds',
      is_remote: false,
    }
    const { score, reasons } = scoreAthleteForListing(athlete, listing)
    expect(score).toBe(100)
    expect(reasons).toContain('Sport matches')
    expect(reasons).toContain('Available now')
  })

  it('awards full weight for open (unspecified) requirements', () => {
    const { score } = scoreAthleteForListing(athlete, { is_remote: false })
    // sport + level + location all open = 70, plus audience 15 + availability 15
    expect(score).toBe(100)
  })

  it('penalises a sport mismatch', () => {
    const listing: MatchListing = { sport_required: 'Tennis', level_required: 'semi_professional', location: 'Leeds' }
    const { score, reasons } = scoreAthleteForListing(athlete, listing)
    expect(score).toBeLessThan(100)
    expect(reasons).not.toContain('Sport matches')
  })

  it('gives partial credit for a secondary-sport match', () => {
    const primary = scoreAthleteForListing(athlete, { sport_required: 'Football' })
    const secondary = scoreAthleteForListing(athlete, { sport_required: 'Futsal' })
    expect(secondary.score).toBeLessThan(primary.score)
    expect(secondary.reasons).toContain('Secondary sport matches')
  })

  it('credits remote listings for location regardless of city', () => {
    const { reasons } = scoreAthleteForListing(
      { ...athlete, home_city: 'Nowhere' },
      { sport_required: 'Football', is_remote: true }
    )
    expect(reasons).toContain('Remote friendly')
  })

  it('scales audience credit by follower count', () => {
    const big = scoreAthleteForListing(athlete, {})
    const small = scoreAthleteForListing({ ...athlete, social_accounts: { instagram_followers: 200 } }, {})
    expect(big.score).toBeGreaterThan(small.score)
  })

  it('clamps to the 0-100 range', () => {
    const { score } = scoreAthleteForListing(
      { availability_status: 'not_available', social_accounts: null },
      { sport_required: 'Tennis', level_required: 'international', location: 'Paris' }
    )
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('sortListingsByMatch', () => {
  it('orders listings best fit first and is stable on ties', () => {
    const listings: (MatchListing & { id: string })[] = [
      { id: 'tennis', sport_required: 'Tennis' },
      { id: 'football', sport_required: 'Football' },
      { id: 'open-a', sport_required: null },
      { id: 'open-b', sport_required: null },
    ]
    const order = sortListingsByMatch(listings, athlete).map((l) => l.id)
    // open listings and the football one all beat tennis; tennis is last
    expect(order[order.length - 1]).toBe('tennis')
    // equal-scoring open-a keeps its position before open-b (stable)
    expect(order.indexOf('open-a')).toBeLessThan(order.indexOf('open-b'))
  })

  it('bestListingMatch returns the top score', () => {
    expect(bestListingMatch(athlete, [{ sport_required: 'Tennis' }, { sport_required: 'Football' }])).toBe(
      scoreAthleteForListing(athlete, { sport_required: 'Football' }).score
    )
  })
})
