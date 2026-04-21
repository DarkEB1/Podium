import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ListingsGrid from './listings-grid'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

const makelisting = (overrides: Partial<JobListingRow>): JobListingRow => ({
  id: 'l1',
  brand_id: 'b1',
  title: 'Football Endorsement',
  type: 'athlete_endorsement',
  description: 'Looking for a footballer',
  sport_required: 'Football',
  level_required: 'semi_professional',
  location: 'London',
  is_remote: false,
  pay_type: 'flat_fee',
  pay_amount: 5000,
  pay_currency: 'GBP',
  deliverables: [],
  exclusivity_required: false,
  contract_duration_months: 6,
  status: 'active',
  application_deadline: null,
  max_hires: null,
  multiple_hires: false,
  number_of_teams_sought: null,
  sponsorship_structure: null,
  total_sponsorship_budget: null,
  usage_rights: null,
  what_expected: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
})

describe('ListingsGrid', () => {
  it('renders all listing titles', () => {
    const listings = [makelisting({ id: 'l1', title: 'Football Deal' }), makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' })]
    render(<ListingsGrid listings={listings} />)
    expect(screen.getByText('Football Deal')).toBeInTheDocument()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('filters listings by sport search', async () => {
    const listings = [makelisting({ id: 'l1', title: 'Football Deal', sport_required: 'Football' }), makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' })]
    render(<ListingsGrid listings={listings} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Tennis')
    expect(screen.queryByText('Football Deal')).toBeNull()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('shows empty state when no listings match', async () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1', sport_required: 'Football' })]} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Archery')
    expect(screen.getByText(/no listings/i)).toBeInTheDocument()
  })
})
