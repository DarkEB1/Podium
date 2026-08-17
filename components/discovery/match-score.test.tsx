import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MatchScore } from './match-score'

describe('MatchScore', () => {
  it('exposes the score as an accessible label', () => {
    render(<MatchScore score={92} />)
    expect(screen.getByLabelText('Match score 92 out of 100')).toBeInTheDocument()
  })

  it('renders a full sweep (stroke-dashoffset 0) for a score of 100', async () => {
    render(<MatchScore score={100} />)
    const arc = screen.getByTestId('match-score-arc')
    await waitFor(() => expect(arc).toHaveAttribute('stroke-dashoffset', '0'))
  })

  it('renders an empty sweep (stroke-dashoffset 100) for a score of 0', async () => {
    render(<MatchScore score={0} />)
    const arc = screen.getByTestId('match-score-arc')
    await waitFor(() => expect(arc).toHaveAttribute('stroke-dashoffset', '100'))
  })

  it('clamps and rounds out-of-range scores', () => {
    render(<MatchScore score={137.6} />)
    expect(screen.getByLabelText('Match score 100 out of 100')).toBeInTheDocument()
  })

  it('shows the match caption only on the lg size', () => {
    render(<MatchScore score={50} size="lg" />)
    expect(screen.getByText('match')).toBeInTheDocument()
  })

  it('omits the match caption on the sm (default) size', () => {
    render(<MatchScore score={50} />)
    expect(screen.queryByText('match')).not.toBeInTheDocument()
  })
})
