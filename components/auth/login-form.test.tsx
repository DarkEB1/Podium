import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginForm from './login-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockToastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}))

describe('LoginForm', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockToastError.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows validation error when fields are empty', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows error toast on INVALID_CREDENTIALS', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' } }),
    } as Response)
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'WrongPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Wrong email or password'))
  })

  it('redirects to /role-select when role is null after login', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: null, role_locked_at: null } }),
    } as Response)
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/role-select'))
  })

  it('redirects to /athlete/dashboard when role is athlete', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: 'athlete', role_locked_at: '2024-01-01T00:00:00Z' } }),
    } as Response)
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/athlete/dashboard'))
  })
})
