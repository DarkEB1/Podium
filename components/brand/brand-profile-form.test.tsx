import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandProfileForm from './brand-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('BrandProfileForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', company_name: 'Acme', status: 'pending_approval' }),
    }))
  })

  it('step 1 renders company name field', () => {
    render(<BrandProfileForm step={1} profile={null} />)
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
  })

  it('step 1 shows validation error when company_name is empty', async () => {
    render(<BrandProfileForm step={1} profile={null} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument()
  })

  it('step 1 calls POST /api/profiles/me on first submission', async () => {
    render(<BrandProfileForm step={1} profile={null} />)
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('step 1 calls PATCH when profile already exists', async () => {
    const profile = { id: '1', company_name: 'Acme', status: 'pending_approval' } as never
    render(<BrandProfileForm step={1} profile={profile} />)
    await userEvent.clear(screen.getByLabelText(/company name/i))
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Updated')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })

  it('step 4 renders a submit for review button', () => {
    const profile = { id: '1', company_name: 'Acme', status: 'pending_approval' } as never
    render(<BrandProfileForm step={4} profile={profile} />)
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument()
  })
})
