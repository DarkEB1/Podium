import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RoleSelectForm from './role-select-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

describe('RoleSelectForm', () => {
  beforeEach(() => {
    mockPush.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'athlete' }),
    }))
  })

  it('renders all four role options', () => {
    render(<RoleSelectForm />)
    expect(document.querySelector('[data-role="athlete"]')).toBeInTheDocument()
    expect(document.querySelector('[data-role="team"]')).toBeInTheDocument()
    expect(document.querySelector('[data-role="brand"]')).toBeInTheDocument()
    expect(document.querySelector('[data-role="agent"]')).toBeInTheDocument()
  })

  it('confirm button is disabled until a role is selected', async () => {
    render(<RoleSelectForm />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
    await userEvent.click(document.querySelector('[data-role="athlete"]')!)
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
  })

  it('calls POST /api/auth/role with selected role on confirm', async () => {
    render(<RoleSelectForm />)
    await userEvent.click(document.querySelector('[data-role="brand"]')!)
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/auth/role', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ role: 'brand' }),
      }))
    )
  })
})
