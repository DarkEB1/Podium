import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileWizard from './profile-wizard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('ProfileWizard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user_id: 'u1', is_under_18: false, status: 'draft' }),
    }))
  })

  it('step 1: shows basic info fields', () => {
    render(<ProfileWizard step={1} profile={null} />)
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument()
  })

  it('step 1: shows validation error for missing display name', async () => {
    render(<ProfileWizard step={1} profile={null} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument()
  })

  it('step 1: calls POST /api/profiles/me on first submit when profile is null', async () => {
    render(<ProfileWizard step={1} profile={null} />)
    await userEvent.type(screen.getByLabelText(/display name/i), 'James')
    await userEvent.type(screen.getByLabelText(/date of birth/i), '1998-05-12')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('step 5: guardian step is skipped when is_under_18 is false', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, display_name: 'James', status: 'draft',
      guardian_name: null, guardian_email: null, guardian_phone: null, guardian_relationship: null,
    }
    render(<ProfileWizard step={5} profile={profile as never} />)
    expect(screen.queryByLabelText(/guardian/i)).toBeNull()
    expect(screen.getByText(/this step is not required/i)).toBeInTheDocument()
  })
})
