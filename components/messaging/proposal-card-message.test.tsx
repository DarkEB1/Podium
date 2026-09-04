import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProposalCardMessage from './proposal-card-message'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']

const makeProposal = (over: Partial<ProposalRow> = {}): ProposalRow =>
  ({
    id: 'prop1',
    match_id: 'm1',
    title: 'Summer campaign',
    status: 'pending',
    pay_amount: 1500,
    pay_currency: 'GBP',
    pay_type: 'flat_fee',
    timeline_start: null,
    ...over,
  }) as unknown as ProposalRow

describe('ProposalCardMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the proposal as a distinct card (not free text) with the title and amount', () => {
    render(<ProposalCardMessage proposal={makeProposal()} isMine={false} onResponded={() => {}} />)

    expect(screen.getByTestId('proposal-card')).toBeInTheDocument()
    expect(screen.getByText('Summer campaign')).toBeInTheDocument()
    expect(screen.getByText(/1,500/)).toBeInTheDocument()
  })

  it('offers Accept, Counter and Decline actions to the recipient on a pending proposal', () => {
    render(<ProposalCardMessage proposal={makeProposal()} isMine={false} onResponded={() => {}} />)

    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /counter/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('does not show action buttons to the sender', () => {
    render(<ProposalCardMessage proposal={makeProposal()} isMine onResponded={() => {}} />)
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  it('invokes onCounter when the recipient clicks Counter (WS-DEAL-01)', () => {
    const onCounter = vi.fn()
    render(
      <ProposalCardMessage
        proposal={makeProposal()}
        isMine={false}
        onResponded={() => {}}
        onCounter={onCounter}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /counter/i }))
    expect(onCounter).toHaveBeenCalledTimes(1)
  })

  it('disables Counter when no onCounter handler is wired', () => {
    render(<ProposalCardMessage proposal={makeProposal()} isMine={false} onResponded={() => {}} />)
    expect(screen.getByRole('button', { name: /counter/i })).toBeDisabled()
  })

  it('renders a payment confirmation as a green success card', () => {
    render(
      <ProposalCardMessage
        proposal={makeProposal({ status: 'accepted' })}
        isMine={false}
        onResponded={() => {}}
        paymentConfirmation={{ amount: 1500, currency: 'GBP' }}
      />
    )

    const card = screen.getByTestId('payment-confirmation-card')
    expect(card).toBeInTheDocument()
    // Uses the semantic success token, never a hardcoded colour.
    expect(card.className).toContain('success')
    // No Accept/Decline on a confirmation card.
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })
})
