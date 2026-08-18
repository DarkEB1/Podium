import { it, expect } from 'vitest'
import { buildRails } from './rails'
import type { ScoredListing } from './match'

const now = new Date('2026-08-16T12:00:00Z')

const base = {
  id: '1',
  title: 'X',
  description: null,
  type: 't',
  status: 'active',
  sport_required: 'Surfing',
  level_required: 'pro',
  location: null,
  is_remote: true,
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
}

function listing(overrides: Partial<ScoredListing>): ScoredListing {
  return {
    ...base,
    matchScore: 0,
    matchReasons: [],
    ...overrides,
  } as never as ScoredListing
}

it('buildRails([]) returns []', () => {
  expect(buildRails([], {})).toEqual([])
})

it('appends top-matches, sorted by matchScore desc, when input is non-empty', () => {
  const a = listing({ id: 'a', matchScore: 10, sport_required: 'Skating' })
  const b = listing({ id: 'b', matchScore: 90, sport_required: 'Skating' })
  const rails = buildRails([a, b], {})
  const top = rails.find((r) => r.id === 'top-matches')
  expect(top).toBeDefined()
  expect(top!.title).toBe('Top matches')
  expect(top!.listings.map((l) => l.id)).toEqual(['b', 'a'])
})

it('includes a because-you-<sport> rail only when athleteSport is set and there is at least one match, sorted by matchScore desc', () => {
  const surf1 = listing({ id: 's1', sport_required: 'Surfing', matchScore: 40 })
  const surf2 = listing({ id: 's2', sport_required: 'Surfing', matchScore: 80 })
  const skate = listing({ id: 'sk1', sport_required: 'Skating', matchScore: 99 })

  const withSport = buildRails([surf1, surf2, skate], { athleteSport: 'surfing', now })
  const onSportRail = withSport.find((r) => r.id === 'because-you-surfing')
  expect(onSportRail).toBeDefined()
  expect(onSportRail!.title).toBe("Because you're into surfing")
  expect(onSportRail!.listings.map((l) => l.id)).toEqual(['s2', 's1'])

  const withoutSport = buildRails([surf1, surf2, skate], { now })
  expect(withoutSport.find((r) => r.id?.startsWith('because-you-'))).toBeUndefined()

  const noMatchSport = buildRails([skate], { athleteSport: 'Basketball', now })
  expect(noMatchSport.find((r) => r.id?.startsWith('because-you-'))).toBeUndefined()
})

it('new-this-week rail filters to getUrgency().kind === "new" and sorts by created_at desc', () => {
  const newer = listing({ id: 'n2', created_at: '2026-08-15T00:00:00Z', matchScore: 1 })
  const older = listing({ id: 'n1', created_at: '2026-08-11T00:00:00Z', matchScore: 1 })
  const stale = listing({ id: 'old', created_at: '2026-01-01T00:00:00Z', matchScore: 1 })

  const rails = buildRails([older, newer, stale], { now })
  const rail = rails.find((r) => r.id === 'new-this-week')
  expect(rail).toBeDefined()
  expect(rail!.title).toBe('New this week')
  expect(rail!.listings.map((l) => l.id)).toEqual(['n2', 'n1'])
})

it('closing-soon rail filters to getUrgency().kind === "closing" and sorts by ascending days', () => {
  const soon = listing({ id: 'c1', application_deadline: '2026-08-17T00:00:00Z', matchScore: 1 })
  const later = listing({ id: 'c2', application_deadline: '2026-08-21T00:00:00Z', matchScore: 1 })
  const notClosing = listing({ id: 'far', application_deadline: '2026-12-01T00:00:00Z', matchScore: 1 })

  const rails = buildRails([later, soon, notClosing], { now })
  const rail = rails.find((r) => r.id === 'closing-soon')
  expect(rail).toBeDefined()
  expect(rail!.title).toBe('Closing soon')
  expect(rail!.listings.map((l) => l.id)).toEqual(['c1', 'c2'])
})

it('omits empty rails (because-you, new-this-week, closing-soon) when nothing qualifies', () => {
  const stale = listing({
    id: 'x',
    sport_required: 'Skating',
    created_at: '2026-01-01T00:00:00Z',
    application_deadline: null,
    matchScore: 5,
  })
  const rails = buildRails([stale], { athleteSport: 'Surfing', now })
  expect(rails.map((r) => r.id)).toEqual(['top-matches'])
})

it('caps each rail at 12 listings', () => {
  const many: ScoredListing[] = Array.from({ length: 20 }, (_, i) =>
    listing({ id: `m${i}`, matchScore: i, sport_required: 'Surfing' })
  )
  const rails = buildRails(many, { athleteSport: 'Surfing', now })
  const top = rails.find((r) => r.id === 'top-matches')
  const onSport = rails.find((r) => r.id === 'because-you-surfing')
  expect(top!.listings.length).toBe(12)
  expect(onSport!.listings.length).toBe(12)
})

it('a listing may appear in more than one rail', () => {
  const listingA = listing({
    id: 'multi',
    sport_required: 'Surfing',
    created_at: '2026-08-15T00:00:00Z',
    matchScore: 50,
  })
  const rails = buildRails([listingA], { athleteSport: 'Surfing', now })
  const ids = rails.map((r) => r.id)
  expect(ids).toContain('because-you-surfing')
  expect(ids).toContain('new-this-week')
  expect(ids).toContain('top-matches')
  for (const rail of rails) {
    expect(rail.listings.map((l) => l.id)).toContain('multi')
  }
})
