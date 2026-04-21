import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandSettingsForm from './brand-settings-form'

describe('BrandSettingsForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', company_name: 'Acme', status: 'active' }),
    }))
  })

  const baseProfile = {
    id: '1',
    company_name: 'Acme Corp',
    trading_name: '',
    headquarters_city: 'London',
    headquarters_country: 'UK',
    website_url: '',
    linkedin_url: '',
    description: '',
    status: 'active',
  } as never

  it('renders company name field pre-filled', () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
  })

  it('shows validation error when company_name is cleared', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.clear(screen.getByLabelText(/company name/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument()
  })

  it('calls PATCH /api/profiles/me on submit', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
