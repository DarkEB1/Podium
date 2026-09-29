import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import PricingPage from './page'

describe('pricing page', () => {
  it('shows the new prices and names, and no matching claim', () => {
    render(<PricingPage />)
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument()
    expect(screen.getByText('£49')).toBeInTheDocument()
    expect(screen.getByText('£99.99')).toBeInTheDocument()
    expect(screen.getByText('£129')).toBeInTheDocument()
    expect(screen.queryByText(/exact-match|3 of 5|maximum-reach/i)).not.toBeInTheDocument()
    // no stale prices
    expect(screen.queryByText('£59')).not.toBeInTheDocument()
    expect(screen.queryByText('£149')).not.toBeInTheDocument()
    expect(screen.queryByText('£299')).not.toBeInTheDocument()
  })

  it('puts Most popular and Best value on Unlimited and the £29 nudge under Growth', () => {
    render(<PricingPage />)
    const unlimitedCard = screen.getByText('Unlimited').closest('div')!
    expect(unlimitedCard).toHaveTextContent('Most popular')
    expect(unlimitedCard).toHaveTextContent('Best value')
    expect(unlimitedCard).toHaveTextContent('Verified brand badge')
    expect(unlimitedCard).toHaveTextContent('Featured to athletes in your area')

    const growthCard = screen.getByText('Growth').closest('div')!
    expect(growthCard).toHaveTextContent('Just £29 more for unlimited')
    expect(growthCard).not.toHaveTextContent('Most popular')

    const starterCard = screen.getByText('Starter').closest('div')!
    expect(starterCard).toHaveTextContent('Search by sport and location only')
    expect(starterCard).toHaveTextContent('1 active listing')
  })
})
