import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PasswordStrength from './password-strength'

describe('PasswordStrength', () => {
  it('shows nothing when password is empty', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container.querySelector('[data-strength]')).toBeNull()
  })

  it('shows weak for short password', () => {
    render(<PasswordStrength password="abc" />)
    expect(screen.getByText(/weak/i)).toBeInTheDocument()
  })

  it('shows fair when 8+ chars + uppercase', () => {
    render(<PasswordStrength password="Abcdefgh" />)
    expect(screen.getByText(/fair/i)).toBeInTheDocument()
  })

  it('shows strong for password meeting all rules', () => {
    render(<PasswordStrength password="ValidPass1!" />)
    expect(screen.getByText(/strong/i)).toBeInTheDocument()
  })
})
