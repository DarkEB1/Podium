import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ListingCard from './listing-card'
import type { JobListingWithBrand } from '@/lib/supabase/discovery'
import { CONNECTION_MESSAGE_MIN, CONNECTION_MESSAGE_MAX } from '@/lib/limits'


const makeListing = (overrides: Partial<JobListingWithBrand> = {}): JobListingWithBrand => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'Acme',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: null,
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

  // DISC1: the brand is identified on the card, not just in the swipe view.
  it('names the brand on the card', () => {
    render(<ListingCard listing={makeListing({ brand_name: 'Stride' })} />)
    expect(screen.getByText('Stride')).toBeInTheDocument()
  })

  // DISC1: a real brand logo is used when the brand has uploaded one.
  it('renders the brand logo image when brand_logo_url is present', () => {
    const { container } = render(
      <ListingCard
        listing={makeListing({ brand_name: 'Stride', brand_logo_url: 'https://cdn.test/stride.png' })}
      />,
    )
    expect(container.querySelector('img[src="https://cdn.test/stride.png"]')).not.toBeNull()
  })

  // DISC7: with no uploaded cover, the card gets a branded tile (a data: URI in
  // the brand's colour), never the shared flat placeholder.
  it('falls back to a branded cover tile when the brand has no cover image', () => {
    render(<ListingCard listing={makeListing({ brand_name: 'Stride', brand_cover_url: null })} />)
    const cover = screen.getByAltText('Stride campaign') as HTMLImageElement
    expect(cover.getAttribute('src') ?? '').toMatch(/^data:image\/svg\+xml/)
  })

  // DISC4: the pay slot is always rendered, even without a fee.
  it('always shows a pay slot, falling back to "Fee undisclosed"', () => {
    render(
      <ListingCard
        listing={makeListing({ title: 'Grassroots fund', pay_amount: null, pay_type: null })}
      />
    )
    expect(screen.getByText(/fee undisclosed/i)).toBeInTheDocument()
  })

  it('opens the request composer when Request is clicked', async () => {
    render(<ListingCard listing={makeListing()} />)
    await userEvent.click(screen.getByRole('button', { name: /request/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    // full description shown in the detail view
    expect(screen.getByText(/Looking for a footballer/)).toBeInTheDocument()
  })

  // DISC3: the message field is not in an error state before any interaction.
  it('does not show the message error state before the user interacts', async () => {
    render(<ListingCard listing={makeListing()} />)
    await userEvent.click(screen.getByRole('button', { name: /request/i }))
    await screen.findByRole('dialog')
    const textarea = screen.getByLabelText(/personalised message/i)
    expect(textarea).toHaveAttribute('aria-invalid', 'false')
  })

  describe('connection request length bounds (PR-8)', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'cr1' }) }))
      )
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    // Regression guard: this composer used to demand a message of at least 300
    // characters while the server rejected anything over 300, so the only
    // sendable message was exactly 300 characters long. The bound is a MAXIMUM.
    it('treats 300 as the maximum, not the minimum', () => {
      expect(CONNECTION_MESSAGE_MAX).toBe(300)
      expect(CONNECTION_MESSAGE_MIN).toBeLessThan(CONNECTION_MESSAGE_MAX)
    })

    it('disables Send below the minimum and enables it well before the maximum', async () => {
      render(<ListingCard listing={makeListing()} />)
      await userEvent.click(screen.getByRole('button', { name: /request/i }))
      await screen.findByRole('dialog')

      const send = screen.getByRole('button', { name: /send request/i })
      expect(send).toBeDisabled()

      const textarea = screen.getByLabelText(/personalised message/i)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN - 1) } })
      expect(send).toBeDisabled()
      expect(
        screen.getByText(new RegExp(`write at least ${CONNECTION_MESSAGE_MIN} characters`, 'i'))
      ).toBeInTheDocument()

      fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN) } })
      expect(send).toBeEnabled()

      // and a mid-range message — previously impossible to send — is fine
      fireEvent.change(textarea, { target: { value: 'a'.repeat(150) } })
      expect(send).toBeEnabled()
    })

    it('posts the brand user id, not the brand profile id (PR-19)', async () => {
      render(
        <ListingCard listing={makeListing({ brand_id: 'bp-99', brand_user_id: 'user-99' })} />
      )
      await userEvent.click(screen.getByRole('button', { name: /request/i }))
      await screen.findByRole('dialog')

      const textarea = screen.getByLabelText(/personalised message/i)
      fireEvent.change(textarea, { target: { value: 'x'.repeat(120) } })
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
      // brand_id would violate connection_requests.recipient_id -> users.id
      expect(body.recipient_id).toBe('user-99')
      expect(body.message).toHaveLength(120)
    })

    it('cannot send when the listing has no resolvable brand user', async () => {
      render(<ListingCard listing={makeListing({ brand_user_id: null })} />)
      await userEvent.click(screen.getByRole('button', { name: /request/i }))
      await screen.findByRole('dialog')

      const textarea = screen.getByLabelText(/personalised message/i)
      fireEvent.change(textarea, { target: { value: 'x'.repeat(120) } })

      expect(screen.getByRole('button', { name: /send request/i })).toBeDisabled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
