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
    const listings = [
      makelisting({ id: 'l1', title: 'Football Deal' }),
      makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' }),
    ]
    render(<ListingsGrid listings={listings} />)
    expect(screen.getByText('Football Deal')).toBeInTheDocument()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('uses a responsive 3/2/1 column grid', () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' })]} />)
    const grid = screen.getByTestId('listings-grid')
    expect(grid.className).toMatch(/grid-cols-1/)
    expect(grid.className).toMatch(/sm:grid-cols-2/)
    expect(grid.className).toMatch(/lg:grid-cols-3/)
  })

  it('has a sticky search bar with a smart placeholder mentioning the count', () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' }), makelisting({ id: 'l2' })]} />)
    const search = screen.getByRole('searchbox')
    expect(search.getAttribute('placeholder')).toMatch(/2 campaigns/i)
    // sticky container
    expect(screen.getByTestId('discover-toolbar').className).toMatch(/sticky/)
  })

  it('shows a results count that updates with filtering', async () => {
    const listings = [
      makelisting({ id: 'l1', title: 'Football Deal', sport_required: 'Football' }),
      makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' }),
    ]
    render(<ListingsGrid listings={listings} />)
    expect(screen.getByTestId('results-count')).toHaveTextContent(/2 results/i)
    await userEvent.type(screen.getByRole('searchbox'), 'Tennis')
    expect(screen.getByTestId('results-count')).toHaveTextContent(/1 result/i)
  })

  it('renders horizontal filter chips for each facet', () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' })]} />)
    for (const label of ['Sport', 'Budget', 'Location', 'Industry', 'Verified']) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('opens a Sport filter dropdown and filters by selection', async () => {
    const listings = [
      makelisting({ id: 'l1', title: 'Football Deal', sport_required: 'Football' }),
      makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' }),
    ]
    render(<ListingsGrid listings={listings} />)
    await userEvent.click(screen.getByRole('button', { name: /sport/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Tennis' }))
    expect(screen.queryByText('Football Deal')).toBeNull()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('offers sort options', () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' })]} />)
    expect(screen.getByLabelText(/sort/i)).toBeInTheDocument()
  })

  it('renders skeleton loaders (not a spinner) while loading', () => {
    render(<ListingsGrid listings={[]} loading />)
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('listings-grid')).toBeNull()
  })

  it('shows a designed empty state when no listings match', async () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1', sport_required: 'Football' })]} />)
    await userEvent.type(screen.getByRole('searchbox'), 'Archery')
    expect(screen.getByText(/no campaigns/i)).toBeInTheDocument()
  })
})
