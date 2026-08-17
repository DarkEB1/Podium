import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import { OpportunityCard } from './opportunity-card'
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

describe('OpportunityCard', () => {
  it('renders the campaign title, brand name and the strongest reason', () => {
    render(<OpportunityCard listing={makeListing()} />)
    expect(screen.getByText('Recovery ambassador, UK surf circuit')).toBeInTheDocument()
    expect(screen.getByText('RecoverLab')).toBeInTheDocument()
    // Only the single strongest reason appears on the card face.
    expect(screen.getByText('Sport and level match')).toBeInTheDocument()
    expect(screen.queryByText('Available now')).not.toBeInTheDocument()
  })

  it('shows the pay in the mono meta row', () => {
    render(<OpportunityCard listing={makeListing()} />)
    const pay = screen.getByText('GBP 5,000')
    expect(pay).toBeInTheDocument()
    expect(pay.closest('.font-mono')).not.toBeNull()
  })

  it('hides the reason row when there are no match reasons', () => {
    render(<OpportunityCard listing={makeListing({ matchReasons: [] })} />)
    expect(screen.queryByText('Sport and level match')).not.toBeInTheDocument()
  })

  it('shows an urgency chip for a listing closing soon, without repeating it in the meta row', () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    render(<OpportunityCard listing={makeListing({ application_deadline: deadline })} />)
    // The urgency label appears exactly once: the top-right chip. The meta
    // row must not repeat it.
    expect(screen.getAllByText(/closes in/i)).toHaveLength(1)
    // Instead the meta row shows a non-redundant fact: the location.
    expect(screen.getByText('London')).toBeInTheDocument()
  })

  it('shows "Remote" in the meta row when there is urgency but no location', () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <OpportunityCard
        listing={makeListing({ application_deadline: deadline, location: null, is_remote: true })}
      />
    )
    expect(screen.getAllByText(/closes in/i)).toHaveLength(1)
    expect(screen.getByText('Remote')).toBeInTheDocument()
  })

  it('shows the contract length in the meta row when there is urgency but no location or remote flag', () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <OpportunityCard
        listing={makeListing({
          application_deadline: deadline,
          location: null,
          is_remote: false,
          contract_duration_months: 6,
        })}
      />
    )
    expect(screen.getByText('6mo')).toBeInTheDocument()
  })

  it('shows the plain deadline text in the meta row when there is no urgency', () => {
    render(
      <OpportunityCard
        listing={makeListing({ application_deadline: null, created_at: '2000-01-01' })}
      />
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('opens the card-back detail when the card body is clicked', async () => {
    render(<OpportunityCard listing={makeListing()} />)
    await userEvent.click(screen.getByRole('button', { name: /open details/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/why this ranks for you/i)).toBeInTheDocument()
  })

  it('disables Save when the listing has no contactable brand user', () => {
    render(<OpportunityCard listing={makeListing({ brand_user_id: null })} />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
