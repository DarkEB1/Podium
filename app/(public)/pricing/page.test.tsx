import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import PricingPage from './page'

describe('pricing page', () => {
  it('shows the new prices and names, and no matching claim', () => {
    render(<PricingPage />)
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('£59')).toBeInTheDocument()
    expect(screen.getByText('£149')).toBeInTheDocument()
    expect(screen.getByText('£299')).toBeInTheDocument()
    expect(screen.queryByText(/exact-match|3 of 5|maximum-reach/i)).not.toBeInTheDocument()
    // no stale prices
    expect(screen.queryByText('£99')).not.toBeInTheDocument()
    expect(screen.queryByText('£249')).not.toBeInTheDocument()
    expect(screen.queryByText('£599')).not.toBeInTheDocument()
  })
})
