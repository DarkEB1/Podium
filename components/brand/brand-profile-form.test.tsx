import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandProfileForm from './brand-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function patchedBody(): Record<string, unknown> {
  const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
  return JSON.parse(mockFetch.mock.calls[0]![1].body) as Record<string, unknown>
}

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
    // A cover image is mandatory; a brand picks one before creating the row.
    const draft = { company_name: '', cover_image_url: 'https://cdn/cover.jpg' } as never
    render(<BrandProfileForm step={1} profile={draft} />)
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('step 1 calls PATCH when profile already exists', async () => {
    const profile = { id: '1', company_name: 'Acme', cover_image_url: 'https://cdn/cover.jpg', status: 'pending_approval' } as never
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

  // --- BR1: brand onboarding visuals (§4A.1) ---

  it('step 1 renders a prominent logo upload with discovery-card preview', () => {
    render(<BrandProfileForm step={1} profile={null} />)
    expect(screen.getByRole('group', { name: /logo/i })).toBeInTheDocument()
    // The discovery-card preview shows how the brand appears in the marketplace.
    expect(screen.getByText(/how you'll appear/i)).toBeInTheDocument()
    expect(screen.getByTestId('marketplace-card')).toBeInTheDocument()
  })

  it('step 1 enforces a mandatory cover image before advancing', async () => {
    render(<BrandProfileForm step={1} profile={null} />)
    expect(screen.getByRole('group', { name: /cover image/i })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/cover image is required/i)).toBeInTheDocument()
  })

  it('step 2 reveals a free-text industry field when Other is the selected industry', () => {
    const profile = { id: '1', company_name: 'Acme', industry: 'other', seeking: [], target_sports: [] } as never
    render(<BrandProfileForm step={2} profile={profile} />)
    expect(screen.getByLabelText(/please specify your industry/i)).toBeInTheDocument()
  })

  it('step 2 hides the free-text industry field for a non-Other industry', () => {
    const profile = { id: '1', company_name: 'Acme', industry: 'sport', seeking: [], target_sports: [] } as never
    render(<BrandProfileForm step={2} profile={profile} />)
    expect(screen.queryByLabelText(/please specify your industry/i)).not.toBeInTheDocument()
  })

  // brand_profiles.industry_other only means anything for the "other" industry:
  // a value left on the row for any other industry is a stale answer.
  it('step 2 sends the free-text industry when Other is selected', async () => {
    const profile = { id: '1', company_name: 'Acme', industry: 'other', seeking: [], target_sports: [] } as never
    render(<BrandProfileForm step={2} profile={profile} />)
    await userEvent.type(screen.getByLabelText(/please specify your industry/i), 'Renewable energy')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(patchedBody()['industry_other']).toBe('Renewable energy')
  })

  // The key is omitted, not nulled: a migration and the code that needs it are
  // separate deploy steps, and naming a column that does not exist yet makes
  // PostgREST reject the whole PATCH, which would fail step 2 for every brand.
  it('step 2 omits the free-text industry entirely for a non-Other industry', async () => {
    const profile = { id: '1', company_name: 'Acme', industry: 'sport', seeking: [], target_sports: [] } as never
    render(<BrandProfileForm step={2} profile={profile} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(patchedBody()).not.toHaveProperty('industry_other')
  })

  // base-ui renders the raw value in the collapsed trigger unless the Select
  // root is given the value→label map.
  it('step 2 shows the human label for a saved industry, not the raw enum', () => {
    const profile = { id: '1', company_name: 'Acme', industry: 'nutrition', seeking: [], target_sports: [] } as never
    render(<BrandProfileForm step={2} profile={profile} />)
    const trigger = screen.getByRole('combobox', { name: /industry/i })
    expect(trigger).toHaveTextContent('Nutrition & Health')
    expect(trigger).not.toHaveTextContent(/^nutrition$/)
  })

  it('step 2 renders "what brand is looking for" as selectable tiles', () => {
    render(<BrandProfileForm step={2} profile={null} />)
    expect(screen.getByText(/looking for/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /endorsement/i })).toHaveAttribute('aria-pressed')
  })

  it('step 2 limits target sports to 5 and errors on the 6th', async () => {
    render(<BrandProfileForm step={2} profile={null} />)
    const sports = ['Football', 'Athletics', 'Tennis', 'Basketball', 'Rugby', 'Cricket']
    for (const s of sports) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${s}$`, 'i') }))
    }
    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum of 5 sports/i)
  })

  it('step 3 shows a live character counter and formatting hint for the description', async () => {
    render(<BrandProfileForm step={3} profile={null} />)
    expect(screen.getByText(/0\/2000 characters/i)).toBeInTheDocument()
    expect(screen.getByText(/keep it concise/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/about your brand/i), 'Hello')
    expect(screen.getByText(/5\/2000 characters/i)).toBeInTheDocument()
  })
})
