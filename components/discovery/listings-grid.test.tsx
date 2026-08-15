import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ListingsGrid from './listings-grid'
import type { JobListingWithBrand } from '@/lib/supabase/discovery'


const makelisting = (overrides: Partial<JobListingWithBrand>): JobListingWithBrand => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'Acme',
  brand_logo_url: null,
  brand_cover_url: null,
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
    for (const label of ['Sport', 'Budget', 'Location', 'Industry']) {
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

  // PR-17 -------------------------------------------------------------------

  it('opening one filter closes the one already open', async () => {
    render(
      <ListingsGrid
        listings={[makelisting({ id: 'l1', sport_required: 'Football', location: 'London' })]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /^sport$/i }))
    expect(screen.getByTestId('filter-popup-sport')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^location$/i }))
    // Exactly one filter popup may be open at a time (FilterGroup exclusivity).
    expect(screen.queryByTestId('filter-popup-sport')).toBeNull()
    expect(screen.getByTestId('filter-popup-location')).toBeInTheDocument()
    expect(screen.getAllByRole('listbox')).toHaveLength(1)
  })

  it('renders the filter popup portalled to the body, above the results grid', async () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1', sport_required: 'Football' })]} />)
    await userEvent.click(screen.getByRole('button', { name: /^sport$/i }))

    const popup = screen.getByTestId('filter-popup-sport')
    // Portalled: not a descendant of the sticky toolbar that used to trap it.
    expect(screen.getByTestId('discover-toolbar').contains(popup)).toBe(false)
    expect(popup.className).toMatch(/z-\[100\]/)
    expect(popup.className).toMatch(/fixed/)
  })

  it('keeps the budget bands starting at "Up to £1,000"', async () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' })]} />)
    await userEvent.click(screen.getByRole('button', { name: /^budget$/i }))
    // Scope to the popup: the native sort <select> also exposes option roles.
    const popup = screen.getByTestId('filter-popup-budget')
    const options = Array.from(popup.querySelectorAll('[role="option"]')).map((o) => o.textContent)
    expect(options[1]).toBe('Up to £1,000')
  })

  // PR-1 (partial) ----------------------------------------------------------

  it('Relevance is a real sort: it ranks a recent, better-paid listing first', () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const fresh = new Date().toISOString()
    const listings = [
      makelisting({ id: 'l1', title: 'Old Cheap Deal', pay_amount: 100, created_at: old }),
      makelisting({ id: 'l2', title: 'Fresh Rich Deal', pay_amount: 50000, created_at: fresh }),
    ]
    render(<ListingsGrid listings={listings} />)

    // Default sort is Relevance — it must actually reorder, not pass through.
    expect((screen.getByLabelText(/sort/i) as HTMLSelectElement).value).toBe('relevance')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles[0]).toBe('Fresh Rich Deal')
  })

  it('Relevance puts a title match ahead of a merely newer listing', async () => {
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const fresh = new Date().toISOString()
    const listings = [
      makelisting({
        id: 'l1',
        title: 'Netball Ambassador',
        description: 'netball',
        sport_required: 'Netball',
        created_at: old,
      }),
      makelisting({
        id: 'l2',
        title: 'Generic Campaign',
        description: 'netball mentioned in the body only',
        sport_required: 'Rugby',
        created_at: fresh,
      }),
    ]
    render(<ListingsGrid listings={listings} />)
    await userEvent.type(screen.getByRole('searchbox'), 'netball')

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles[0]).toBe('Netball Ambassador')
  })

  it('offers no facet that cannot filter anything', () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1' })]} />)
    // "Verified" was a hardcoded `return true`; there is no brand verification
    // column, so the control is gone rather than lying.
    expect(screen.queryByRole('button', { name: /verified/i })).toBeNull()
  })
})
