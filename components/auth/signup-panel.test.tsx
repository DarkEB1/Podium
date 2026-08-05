import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SignUpPanel, { SignUpPanelFallback } from './signup-panel'

// The role now arrives from the client-side query read rather than from the
// page's `searchParams`, which is what let /auth/signup go back to being
// statically prerendered.
const searchParams = { value: '' }
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParams.value),
  useRouter: () => ({ push: vi.fn() }),
}))

function renderWithQuery(query: string) {
  searchParams.value = query
  return render(<SignUpPanel />)
}

describe('SignUpPanel', () => {
  it('shows the athlete headline for ?role=athlete', () => {
    renderWithQuery('role=athlete')
    expect(screen.getByRole('heading', { name: /create your athlete profile/i })).toBeInTheDocument()
  })

  it('shows the brand headline for ?role=brand', () => {
    renderWithQuery('role=brand')
    expect(screen.getByRole('heading', { name: /start finding talent/i })).toBeInTheDocument()
  })

  it('falls back to the generic headline with no role', () => {
    renderWithQuery('')
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  // parseRole narrows arbitrary query input; an unknown value must not index
  // the headline map and must not reach the form as a role.
  it('ignores an unrecognised role', () => {
    renderWithQuery('role=admin')
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('renders the sign-up form in the fallback too, so the page is usable while the query is read', () => {
    render(<SignUpPanelFallback />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })
})
