import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SignUpForm from './sign-up-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('SignUpForm', () => {
  beforeEach(() => {
    mockPush.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Check your email to verify your account' }),
    }))
  })

  it('shows validation error when email is missing', async () => {
    render(<SignUpForm />)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows password requirement hint when password is too weak', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'weak')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/8 characters/i)).toBeInTheDocument()
  })

  it('calls POST /api/auth/signup on valid submission', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass1!')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/verify-email'))
  })
})
