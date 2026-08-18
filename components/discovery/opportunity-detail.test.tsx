import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import { OpportunityDetail } from './opportunity-detail'
import type { ScoredListing } from '@/lib/discovery/match'
import { CONNECTION_MESSAGE_MIN } from '@/lib/limits'

const makeListing = (overrides: Partial<ScoredListing> = {}): ScoredListing => ({
  id: 'l1',
  brand_id: 'b1',
  brand_user_id: 'brand-user-1',
  brand_name: 'RecoverLab',
  brand_logo_url: null,
  brand_cover_url: null,
  brand_description: 'We make recovery kit for water-sports athletes, backed by 40 pro partners.',
  title: 'Recovery ambassador, UK surf circuit',
  type: 'athlete_endorsement',
  description: 'A recovery brand looking for a surf ambassador.',
  sport_required: 'Surf',
  level_required: 'professional',
  location: 'London',
  is_remote: true,
  pay_type: 'flat_fee',
  pay_amount: 1200,
  pay_currency: 'GBP',
  contract_duration_months: 3,
  status: 'active',
  application_deadline: null,
  created_at: '2024-01-01',
  matchScore: 92,
  matchReasons: ['Sport matches', 'Level matches', 'Remote friendly', 'Available now'],
  ...overrides,
})

describe('OpportunityDetail', () => {
  it('renders the brand description and every match reason', () => {
    render(<OpportunityDetail listing={makeListing()} open onOpenChange={() => {}} />)
    expect(
      screen.getByText(/We make recovery kit for water-sports athletes/)
    ).toBeInTheDocument()
    for (const reason of ['Sport matches', 'Level matches', 'Remote friendly', 'Available now']) {
      expect(screen.getByText(reason)).toBeInTheDocument()
    }
  })

  it('disables the composer Send button until the message reaches the minimum', async () => {
    render(<OpportunityDetail listing={makeListing()} open onOpenChange={() => {}} />)

    // Open the composer from the card-back action.
    await userEvent.click(screen.getByRole('button', { name: /send request/i }))

    const textarea = await screen.findByLabelText(/personalised message/i)
    // The composer submit lives inside the composer dialog popup.
    const composer = textarea.closest('[data-slot="dialog-content"]') as HTMLElement
    const send = within(composer).getByRole('button', { name: /send request/i })

    expect(send).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN - 1) } })
    expect(send).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(CONNECTION_MESSAGE_MIN) } })
    expect(send).toBeEnabled()
  })

  it('disables Save when the listing has no contactable brand user', () => {
    render(
      <OpportunityDetail listing={makeListing({ brand_user_id: null })} open onOpenChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})
