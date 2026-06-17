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

  // spec §3A.1–3A.2: country + profile photo are both mandatory and block advance.
  it('step 1: renders a mandatory CountrySelect and circular profile photo upload', () => {
    render(<ProfileWizard step={1} profile={null} />)
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /profile photo/i })).toBeInTheDocument()
    // Subtext nudging a clear face photo (spec §3A.2).
    expect(screen.getByText(/clear photo of your face/i)).toBeInTheDocument()
  })

  it('step 1: cannot advance without a profile photo — shows the required message', async () => {
    render(<ProfileWizard step={1} profile={null} />)
    await userEvent.type(screen.getByLabelText(/display name/i), 'James')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(
      await screen.findByText(/please add a profile photo to continue/i)
    ).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('step 1: calls POST /api/profiles/me once display name + photo + country are set', async () => {
    render(<ProfileWizard step={1} profile={{ user_id: 'u1', profile_photo_url: 'https://cdn/x.jpg', home_country: 'GB', status: 'draft' } as never} />)
    await userEvent.type(screen.getByLabelText(/display name/i), 'James')
    await userEvent.type(screen.getByLabelText(/date of birth/i), '1998-05-12')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as Record<string, unknown>
    expect(body).toMatchObject({ home_country: 'GB', profile_photo_url: 'https://cdn/x.jpg' })
  })

  // spec §3A.3: 8 levels, conditional secondary fields per selected level.
  it('step 2: all 8 levels are offered in the level selector', async () => {
    render(<ProfileWizard step={2} profile={null} />)
    await userEvent.click(screen.getByRole('combobox', { name: /level/i }))
    for (const label of [
      /^recreational$/i, /^amateur$/i, /^semi-professional$/i, /^professional$/i,
      /^international$/i, /^university \/ bucs$/i, /^academy$/i, /^national$/i,
    ]) {
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument()
    }
  })

  it('step 2: University/BUCS level reveals team autocomplete + highest-level-outside field', async () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'university_bucs' }
    render(<ProfileWizard step={2} profile={profile as never} />)
    expect(screen.getByLabelText(/university.*team/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/highest level played outside university/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/academy/i)).toBeNull()
    expect(screen.queryByLabelText(/programme/i)).toBeNull()
  })

  it('step 2: Academy level reveals academy/club free text only', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'academy' }
    render(<ProfileWizard step={2} profile={profile as never} />)
    expect(screen.getByLabelText(/academy.*club/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/university.*team/i)).toBeNull()
    expect(screen.queryByLabelText(/programme/i)).toBeNull()
  })

  it('step 2: National level reveals programme free text only', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'national' }
    render(<ProfileWizard step={2} profile={profile as never} />)
    expect(screen.getByLabelText(/programme/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/university.*team/i)).toBeNull()
    expect(screen.queryByLabelText(/academy.*club/i)).toBeNull()
  })

  it('step 2: persists secondary fields for University/BUCS to the B1 columns', async () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft', level: 'university_bucs',
      primary_sport: 'Rugby', university_team: '', highest_level: null,
    }
    render(<ProfileWizard step={2} profile={profile as never} />)
    await userEvent.type(screen.getByLabelText(/highest level played outside university/i), 'amateur')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as Record<string, unknown>
    expect(body).toHaveProperty('university_team')
    expect(body).toHaveProperty('highest_level')
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
