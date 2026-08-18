import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import { useListingFilters, ListingsToolbar } from './listings-filter'
import type { ListingSummary } from '@/lib/supabase/discovery'

const makeListing = (overrides: Partial<ListingSummary>): ListingSummary => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'Acme',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: null,
  title: 'Football Endorsement',
  type: 'athlete_endorsement',
  description: 'Looking for a footballer',
  sport_required: 'Football',
  level_required: null,
  location: 'London',
  is_remote: false,
  pay_type: 'flat_fee',
  pay_amount: 5000,
  pay_currency: 'GBP',
  contract_duration_months: 6,
  application_deadline: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

/**
 * A minimal consumer of the hook, mirroring how ListingsGrid wires
 * `useListingFilters` + `ListingsToolbar` together, so this test exercises the
 * real facet-threading path (toolbar chip -> setFilter -> filtered listings).
 */
function TestHarness({ listings }: { listings: ListingSummary[] }) {
  const state = useListingFilters(listings)
  return (
    <div>
      <ListingsToolbar state={state} listings={listings} />
      <ul>
        {state.filtered.map((l) => (
          <li key={l.id}>{l.title}</li>
        ))}
      </ul>
    </div>
  )
}

describe('useListingFilters payType facet', () => {
  it('renders a Pay type filter chip', () => {
    render(<TestHarness listings={[makeListing({ id: 'l1' })]} />)
    expect(screen.getByRole('button', { name: /pay type/i })).toBeInTheDocument()
  })

  it('filters out listings whose pay_type does not match the selection, and clearing restores them', async () => {
    const listings = [
      makeListing({ id: 'l1', title: 'Per Post Deal', pay_type: 'per_post' }),
      makeListing({ id: 'l2', title: 'Retainer Deal', pay_type: 'monthly_retainer' }),
    ]
    render(<TestHarness listings={listings} />)

    expect(screen.getByText('Per Post Deal')).toBeInTheDocument()
    expect(screen.getByText('Retainer Deal')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /pay type/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Per post' }))

    expect(screen.getByText('Per Post Deal')).toBeInTheDocument()
    expect(screen.queryByText('Retainer Deal')).toBeNull()

    // Clearing the facet restores the dropped listing.
    await userEvent.click(screen.getByRole('button', { name: /pay type: per post/i }))
    await userEvent.click(await screen.findByRole('option', { name: /any pay type/i }))

    expect(screen.getByText('Per Post Deal')).toBeInTheDocument()
    expect(screen.getByText('Retainer Deal')).toBeInTheDocument()
  })
})
