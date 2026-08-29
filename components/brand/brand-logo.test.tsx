import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrandLogo from './brand-logo'

describe('BrandLogo', () => {
  it('renders the uploaded logo when the brand has one', () => {
    render(<BrandLogo name="Acme Sports" logoUrl="https://cdn.example/acme.png" />)
    const img = screen.getByRole('img', { name: 'Acme Sports logo' })
    expect(img).toHaveAttribute('src', 'https://cdn.example/acme.png')
  })

  it('falls back to a monogram when no logo is set', () => {
    render(<BrandLogo name="Acme Sports" logoUrl={null} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('AS')).toBeInTheDocument()
  })
})
