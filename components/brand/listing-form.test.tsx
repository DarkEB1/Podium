import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ListingForm from './listing-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('ListingForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'list-1', title: 'Test', type: 'athlete_endorsement', status: 'draft' }),
    }))
  })

  it('renders title and type fields', () => {
    render(<ListingForm listing={null} />)
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByText(/listing type/i)).toBeInTheDocument()
  })

  it('shows validation error when title is empty', async () => {
    render(<ListingForm listing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('calls POST /api/discovery/listings on create', async () => {
    render(<ListingForm listing={null} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Sponsorship 2026')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/discovery/listings', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('calls PATCH on edit', async () => {
    const listing = { id: 'list-1', title: 'Old Title', type: 'athlete_endorsement', status: 'draft', brand_id: 'b1', created_at: '', updated_at: '', description: null, sport_required: null, level_required: null, location: null, is_remote: false, pay_type: null, pay_amount: null, pay_currency: 'GBP', contract_duration_months: null, application_deadline: null, exclusivity_required: false, multiple_hires: false, max_hires: null, number_of_teams_sought: null, total_sponsorship_budget: null, sponsorship_structure: null, deliverables: [], what_expected: null, usage_rights: null } as never
    render(<ListingForm listing={listing} />)
    await userEvent.clear(screen.getByLabelText(/title/i))
    await userEvent.type(screen.getByLabelText(/title/i), 'New Title')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(`/api/discovery/listings/list-1`, expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
