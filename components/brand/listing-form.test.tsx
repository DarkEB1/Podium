import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ListingForm from './listing-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const baseListing = {
  id: 'list-1', title: 'Old Title', type: 'athlete_endorsement', status: 'draft', brand_id: 'b1',
  created_at: '', updated_at: '', description: null, sport_required: null, level_required: null,
  location: null, is_remote: false, pay_type: null, pay_amount: null, pay_currency: 'GBP',
  contract_duration_months: null, application_deadline: null, exclusivity_required: false,
  multiple_hires: false, max_hires: null, number_of_teams_sought: null, total_sponsorship_budget: null,
  sponsorship_structure: null, deliverables: [], what_expected: null, usage_rights: null,
}

function postedBody(): Record<string, unknown> {
  const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
  return JSON.parse(mockFetch.mock.calls[0]![1].body) as Record<string, unknown>
}

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

  // application_deadline is a timestamptz column and the date input yields ''
  // when left blank. Postgres rejects '' with 22007, which failed the whole
  // insert and blocked a brand from ever creating a listing.
  it('never sends an empty string as the application deadline', async () => {
    render(<ListingForm listing={null} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Sponsorship 2026')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(postedBody()['application_deadline']).not.toBe('')
    expect(postedBody()['application_deadline']).toBeNull()
  })

  // base-ui renders the raw value in the collapsed trigger unless the Select
  // root is given the value→label map.
  it('shows the human label for a saved listing type, not the raw enum', () => {
    render(<ListingForm listing={{ ...baseListing, type: 'team_sponsorship' } as never} />)
    const trigger = screen.getByRole('combobox', { name: /listing type/i })
    expect(trigger).toHaveTextContent('Team sponsorship')
    expect(trigger).not.toHaveTextContent(/team_sponsorship/)
  })

  it('shows the human label for a saved pay type, not the raw enum', () => {
    render(<ListingForm listing={{ ...baseListing, pay_type: 'monthly_retainer' } as never} />)
    const trigger = screen.getByRole('combobox', { name: /pay type/i })
    expect(trigger).toHaveTextContent('Monthly retainer')
    expect(trigger).not.toHaveTextContent(/monthly_retainer/)
  })
})
