import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ListingCard from './listing-card'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

const makeListing = (overrides: Partial<JobListingRow> = {}): JobListingRow => ({
  id: 'l1',
  brand_id: 'b1',
  title: 'Football Endorsement',
  type: 'athlete_endorsement',
  description: 'Looking for a footballer to represent our energy brand across social.',
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

describe('ListingCard', () => {
  it('renders the listing via a MarketplaceCard with title and subtitle', () => {
    render(<ListingCard listing={makeListing({ title: 'Tennis Deal' })} />)
    expect(screen.getByTestId('marketplace-card')).toBeInTheDocument()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
    // subtitle combines sport and level
    expect(screen.getByText(/Football/)).toBeInTheDocument()
  })

  it('opens the campaign detail dialog when View is clicked', async () => {
    render(<ListingCard listing={makeListing()} />)
    await userEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    // full description shown in the detail view
    expect(screen.getByText(/Looking for a footballer/)).toBeInTheDocument()
  })

  describe('connection request 300-char minimum gate', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'cr1' }) }))
      )
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('disables Send until the message reaches 300 characters', async () => {
      render(<ListingCard listing={makeListing()} />)
      await userEvent.click(screen.getByRole('button', { name: /view/i }))
      await screen.findByRole('dialog')

      const send = screen.getByRole('button', { name: /send request/i })
      expect(send).toBeDisabled()

      const textarea = screen.getByLabelText(/personalised message/i)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(299) } })
      expect(send).toBeDisabled()
      // counter communicates the minimum requirement, not via colour alone
      expect(screen.getByText(/write at least 300 characters/i)).toBeInTheDocument()

      fireEvent.change(textarea, { target: { value: 'a'.repeat(300) } })
      expect(send).toBeEnabled()
    })

    it('posts the connection request once the minimum is met', async () => {
      render(<ListingCard listing={makeListing({ brand_id: 'brand-99' })} />)
      await userEvent.click(screen.getByRole('button', { name: /view/i }))
      await screen.findByRole('dialog')

      const textarea = screen.getByLabelText(/personalised message/i)
      fireEvent.change(textarea, { target: { value: 'x'.repeat(300) } })
      await userEvent.click(screen.getByRole('button', { name: /send request/i }))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/discovery/connections',
          expect.objectContaining({ method: 'POST' })
        )
      })
      const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
      const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined
      const body = JSON.parse(String(init?.body)) as { recipient_id: string; message: string }
      expect(body.recipient_id).toBe('brand-99')
      expect(body.message).toHaveLength(300)
    })
  })
})
