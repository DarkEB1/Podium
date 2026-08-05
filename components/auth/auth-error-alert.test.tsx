import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AuthErrorAlert from './auth-error-alert'
import { AUTH_ERROR_CODES } from './auth-errors'

const searchParams = { value: '' }
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParams.value),
}))

function renderWithQuery(query: string) {
  searchParams.value = query
  return render(<AuthErrorAlert />)
}

describe('AuthErrorAlert', () => {
  it('renders nothing when there is no error code', () => {
    const { container } = renderWithQuery('')
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the human message for a known code', () => {
    renderWithQuery(`error=${AUTH_ERROR_CODES.expiredLink}`)
    expect(screen.getByTestId('auth-error')).toBeInTheDocument()
    expect(screen.getByText(/that link has expired/i)).toBeInTheDocument()
  })

  // Unknown codes fall back to the generic sentence by design, so a raw code
  // (including anything a third party appends to the URL) never reaches the
  // screen. See authErrorMessage.
  it('shows the generic message for an unrecognised code, never the code itself', () => {
    renderWithQuery('error=not_a_real_code')
    expect(screen.getByTestId('auth-error')).toBeInTheDocument()
    expect(screen.getByText(/could not finish signing you in/i)).toBeInTheDocument()
    expect(screen.queryByText(/not_a_real_code/)).toBeNull()
  })
})
