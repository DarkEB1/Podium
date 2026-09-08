import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractTermsBlock } from './contract-terms-block'

describe('ContractTermsBlock', () => {
  it('renders the key terms from the snapshot', () => {
    render(<ContractTermsBlock terms={{
      title: 'Summer Deal', pay_amount: 5000, pay_currency: 'GBP', pay_type: 'flat_fee',
      timeline_start: '2026-06-01', timeline_end: '2026-08-31',
      deliverables: { text: '3 posts' }, usage_rights: { text: 'Social' }, additional_terms: 'None',
    }} />)
    expect(screen.getByText('Summer Deal')).toBeInTheDocument()
    expect(screen.getByText(/£5,000|GBP\s*5,000/)).toBeInTheDocument()
    expect(screen.getByText('3 posts')).toBeInTheDocument()
  })

  it('renders the "This is what you\'re signing" heading', () => {
    render(<ContractTermsBlock terms={{ title: 'Deal' }} />)
    expect(screen.getByText("This is what you're signing")).toBeInTheDocument()
  })

  it('handles a plain-string deliverables/usage_rights value (not just jsonb {text})', () => {
    render(<ContractTermsBlock terms={{
      title: 'Deal', pay_amount: 100, pay_currency: 'GBP', pay_type: 'flat_fee',
      deliverables: 'Two stories', usage_rights: 'Paid social only',
    }} />)
    expect(screen.getByText('Two stories')).toBeInTheDocument()
    expect(screen.getByText('Paid social only')).toBeInTheDocument()
  })

  it('omits optional rows that are absent from the snapshot', () => {
    render(<ContractTermsBlock terms={{ title: 'Bare Deal', pay_amount: 10, pay_currency: 'GBP' }} />)
    expect(screen.queryByText(/deliverables/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/usage rights/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/additional terms/i)).not.toBeInTheDocument()
  })
})
