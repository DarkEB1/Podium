import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import BrandChatEntry from './brand-chat-entry'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']

// ChatWindow uses the Supabase realtime client + fetch; stub it so the wrapper
// can mount its post-proposal branch in jsdom without network access.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }),
}))

// jsdom does not implement scrollIntoView, which ChatWindow calls on mount.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const makeProposal = (): ProposalRow =>
  ({
    id: 'prop1',
    match_id: 'm1',
  } as unknown as ProposalRow)

const baseProps = {
  matchId: 'm1',
  currentUserId: 'u1',
  initialMessages: [],
}

describe('BrandChatEntry', () => {
  it('hides the free-text composer and shows the proposal CTA before any proposal is sent', () => {
    render(<BrandChatEntry {...baseProps} proposals={[]} />)

    // Free-text message input must NOT be present pre-proposal.
    expect(screen.queryByPlaceholderText(/type a message/i)).toBeNull()

    // Mandatory-proposal CTA + explanatory text must be visible.
    expect(
      screen.getByRole('button', { name: /send a proposal/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/requires you to send a formal proposal/i)).toBeInTheDocument()
  })

  it('opens the proposal form as a modal when Create/Send a Proposal is clicked', async () => {
    const user = userEvent.setup()
    render(<BrandChatEntry {...baseProps} proposals={[]} />)

    await user.click(screen.getByRole('button', { name: /send a proposal/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // proposal-form title field
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
  })

  it('shows the free-text composer once a proposal exists', () => {
    render(<BrandChatEntry {...baseProps} proposals={[makeProposal()]} />)

    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    // The blocking CTA is gone once messaging is unlocked.
    expect(screen.queryByText(/requires you to send a formal proposal/i)).toBeNull()
  })
})
