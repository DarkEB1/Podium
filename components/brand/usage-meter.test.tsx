import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageMeter } from './usage-meter'

describe('UsageMeter', () => {
  it('shows used over limit', () => {
    render(<UsageMeter label="Connection requests" used={12} limit={15} />)
    expect(screen.getByText(/12 \/ 15/)).toBeInTheDocument()
  })
  it('shows unlimited when limit is null', () => {
    render(<UsageMeter label="Messaging" used={0} limit={null} />)
    expect(screen.getByText(/Unlimited/i)).toBeInTheDocument()
  })
})
