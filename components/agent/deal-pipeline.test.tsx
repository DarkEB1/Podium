import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DealPipeline, {
  type PipelineDeal,
  PIPELINE_STAGES,
  stageForContractStatus,
} from './deal-pipeline'

const deals: PipelineDeal[] = [
  { id: 'd1', clientName: 'Maya Okoro', brandName: 'Aurora', stage: 'proposal_sent', updatedAt: '2026-06-10T00:00:00Z' },
  { id: 'd2', clientName: 'Tom Reed', brandName: 'Brio', stage: 'under_negotiation', updatedAt: '2026-06-11T00:00:00Z' },
  { id: 'd3', clientName: 'Maya Okoro', brandName: 'Crest', stage: 'awaiting_signature', updatedAt: '2026-06-12T00:00:00Z' },
  { id: 'd4', clientName: 'Tom Reed', brandName: 'Delta', stage: 'completed', updatedAt: '2026-06-09T00:00:00Z' },
  { id: 'd5', clientName: 'Maya Okoro', brandName: 'Echo', stage: 'awaiting_signature', updatedAt: '2026-06-13T00:00:00Z' },
]

describe('DealPipeline', () => {
  it('renders all four stage columns with human-readable headings', () => {
    render(<DealPipeline deals={deals} />)
    expect(screen.getByRole('heading', { name: /proposal sent/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /under negotiation/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /awaiting signature/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /completed/i })).toBeInTheDocument()
  })

  it('groups each deal under its stage column', () => {
    render(<DealPipeline deals={deals} />)
    const awaiting = screen.getByTestId('stage-awaiting_signature')
    expect(within(awaiting).getByText('Crest')).toBeInTheDocument()
    expect(within(awaiting).getByText('Echo')).toBeInTheDocument()
    // two deals in awaiting_signature, none leaked into proposal_sent
    const proposal = screen.getByTestId('stage-proposal_sent')
    expect(within(proposal).queryByText('Crest')).toBeNull()
    expect(within(proposal).getByText('Aurora')).toBeInTheDocument()
  })

  it('shows a per-stage count badge', () => {
    render(<DealPipeline deals={deals} />)
    const awaiting = screen.getByTestId('stage-awaiting_signature')
    expect(within(awaiting).getByText('2')).toBeInTheDocument()
  })

  it('exposes exactly the four spec stages in order', () => {
    expect(PIPELINE_STAGES.map((s) => s.id)).toEqual([
      'proposal_sent',
      'under_negotiation',
      'awaiting_signature',
      'completed',
    ])
  })

  it('maps contract_status enum values onto pipeline stages', () => {
    expect(stageForContractStatus('draft')).toBe('under_negotiation')
    expect(stageForContractStatus('pending_brand_signature')).toBe('awaiting_signature')
    expect(stageForContractStatus('pending_athlete_signature')).toBe('awaiting_signature')
    expect(stageForContractStatus('fully_signed')).toBe('completed')
    expect(stageForContractStatus('terminated')).toBeNull()
  })
})
