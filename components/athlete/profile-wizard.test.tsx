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

  // Regression for spec §3A.5 / acceptance §7.6 ("Step 6 of 5 / 120%").
  it('adult final step reads "Step 5 of 5" and 100% (never 6 of 5 / 120%)', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft' }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.getByText(/step 5 of 5/i)).toBeInTheDocument()
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.queryByText(/step 6 of 5/i)).toBeNull()
    expect(screen.queryByText(/120%/)).toBeNull()
  })

  it('u18 final step reads "Step 6 of 6" and 100%', () => {
    const profile = { user_id: 'u1', is_under_18: true, status: 'draft' }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument()
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('progress never exceeds 100% across every adult route index', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft' }
    for (const step of [1, 2, 3, 4, 6]) {
      const { unmount } = render(<ProfileWizard step={step} profile={profile as never} />)
      const pct = screen.getAllByText(/%$/)[0]?.textContent ?? '0%'
      expect(Number.parseInt(pct, 10)).toBeLessThanOrEqual(100)
      unmount()
    }
  })
})
