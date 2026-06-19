import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProposalForm from './proposal-form'
import { copy } from '@/lib/copy'

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }))

describe('ProposalForm', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'p1', title: 'Deal', status: 'pending' }),
    }))
  })

  it('renders title and pay_amount fields', () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
  })

  it('shows validation error when required fields are missing', async () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('calls POST /api/deals/proposals on valid submission', async () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Deal')
    await userEvent.type(screen.getByLabelText(/amount/i), '5000')
    await userEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/deals/proposals', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('confirms a sent proposal with the energetic Podium toast copy', async () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Deal')
    await userEvent.type(screen.getByLabelText(/amount/i), '5000')
    await userEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(copy.toasts.proposalSent))
  })
})
