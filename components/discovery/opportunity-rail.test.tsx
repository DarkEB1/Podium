import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { OpportunityRail } from './opportunity-rail'
import type { Rail } from '@/lib/discovery/rails'
import type { ScoredListing } from '@/lib/discovery/match'

const makeListing = (overrides: Partial<ScoredListing> = {}): ScoredListing => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'RecoverLab',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: 'We make recovery kit for water-sports athletes.',
  title: 'Recovery ambassador, UK surf circuit',
  type: 'athlete_endorsement',
  description: 'A recovery brand looking for a surf ambassador.',
  sport_required: 'Surf',
  level_required: 'professional',
  location: 'London',
  is_remote: true,
  pay_type: 'flat_fee',
  pay_amount: 5000,
  pay_currency: 'GBP',
  contract_duration_months: 3,
  status: 'active',
  application_deadline: null,
  created_at: '2024-01-01',
  matchScore: 92,
  matchReasons: ['Sport and level match', 'Available now'],
  ...overrides,
})

const makeRail = (overrides: Partial<Rail> = {}): Rail => ({
  id: 'because-you-surf',
  title: 'Because you surf',
  listings: [
    makeListing({ id: 'l1', title: 'Recovery ambassador, UK surf circuit' }),
    makeListing({ id: 'l2', title: 'Hydration partner for the summer season' }),
    makeListing({ id: 'l3', title: 'Coastal apparel capsule drop' }),
  ],
  ...overrides,
})

describe('OpportunityRail', () => {
  it('renders the rail title', () => {
    render(<OpportunityRail rail={makeRail()} index={0} />)
    expect(screen.getByText('Because you surf')).toBeInTheDocument()
  })

  it('renders one card per listing', () => {
    const rail = makeRail()
    render(<OpportunityRail rail={rail} index={0} />)
    expect(screen.getByText('Recovery ambassador, UK surf circuit')).toBeInTheDocument()
    expect(screen.getByText('Hydration partner for the summer season')).toBeInTheDocument()
    expect(screen.getByText('Coastal apparel capsule drop')).toBeInTheDocument()
  })

  it('labels the scroll row as a region named after the rail title', () => {
    render(<OpportunityRail rail={makeRail()} index={0} />)
    expect(screen.getByRole('region', { name: 'Because you surf' })).toBeInTheDocument()
  })

  it('shows the two-digit index and the listing count', () => {
    render(<OpportunityRail rail={makeRail()} index={2} />)
    expect(screen.getByText('03')).toBeInTheDocument()
    expect(screen.getByText('3 in rail')).toBeInTheDocument()
  })

  it('shows the subtitle when present', () => {
    render(<OpportunityRail rail={makeRail({ subtitle: 'Matched on sport' })} index={0} />)
    expect(screen.getByText('Matched on sport')).toBeInTheDocument()
  })
})
