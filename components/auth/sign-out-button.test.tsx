import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

import SignOutButton from './sign-out-button'

const assign = vi.fn()

describe('SignOutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement navigation; stub the one method used.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign, href: 'http://localhost/athlete/discover' },
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, redirectTo: '/' }),
    }) as unknown as typeof fetch
  })

  it('renders a visible sign out control', () => {
    render(<SignOutButton />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls the logout route and returns the user to the home page', async () => {
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      expect(assign).toHaveBeenCalledWith('/')
    })
  })

  it('surfaces an error instead of failing silently', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch
    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(assign).not.toHaveBeenCalled()
  })
})
