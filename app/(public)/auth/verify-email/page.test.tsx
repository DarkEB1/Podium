import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import VerifyEmailPage from './page'

describe('VerifyEmailPage', () => {
  it('tells the user to check spam in the main sent-message, not only the footer', () => {
    render(<VerifyEmailPage />)
    const sent = screen.getByText(/we sent a verification link/i)
    expect(sent.textContent).toMatch(/spam/i)
    expect(sent.textContent).toMatch(/junk/i)
  })
})
