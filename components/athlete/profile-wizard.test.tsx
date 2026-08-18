import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileWizard from './profile-wizard'
import { copy } from '@/lib/copy'

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
    // Subtext nudging a photo, in the energetic Podium voice (copy.prompts.addPhoto).
    expect(screen.getByText(copy.prompts.addPhoto)).toBeInTheDocument()
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

  // Same base-ui constraint as the availability trigger below: the collapsed
  // trigger shows the raw enum unless the Select root is given the label map.
  it('step 2: the level trigger shows the human label for a saved level', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'semi_professional' }
    render(<ProfileWizard step={2} profile={profile as never} />)
    const trigger = screen.getByRole('combobox', { name: /^level$/i })
    expect(trigger).toHaveTextContent('Semi-Professional')
    expect(trigger).not.toHaveTextContent(/semi_professional/)
  })

  it('step 2: the highest-level trigger shows the human label for a saved level', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft',
      level: 'university_bucs', highest_level: 'semi_professional',
    }
    render(<ProfileWizard step={2} profile={profile as never} />)
    const trigger = screen.getByRole('combobox', { name: /highest level played outside university/i })
    expect(trigger).toHaveTextContent('Semi-Professional')
    expect(trigger).not.toHaveTextContent(/semi_professional/)
  })

  // spec §3A.4: clean human-readable availability labels; selecting "Available
  // From" reveals an inline date picker (otherwise hidden).
  it('step 3: availability options use clean human-readable labels', async () => {
    render(<ProfileWizard step={3} profile={null} />)
    await userEvent.click(screen.getByRole('combobox', { name: /availability/i }))
    for (const label of [/^Available Now$/, /^Available From a Date$/, /^Not Available$/]) {
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument()
    }
  })

  it('step 3: the date picker is hidden until "Available From" is selected', () => {
    render(<ProfileWizard step={3} profile={null} />)
    expect(screen.queryByLabelText(/available from/i)).toBeNull()
  })

  it('step 3: selecting "Available From a Date" reveals the inline date picker', async () => {
    render(<ProfileWizard step={3} profile={null} />)
    await userEvent.click(screen.getByRole('combobox', { name: /availability/i }))
    await userEvent.click(await screen.findByRole('option', { name: /^Available From a Date$/ }))
    const date = await screen.findByLabelText(/available from/i)
    expect(date).toBeInTheDocument()
    expect(date).toHaveAttribute('type', 'date')
  })

  it('step 3: a saved "Available From" profile shows the date picker pre-filled', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft',
      availability_status: 'available_from', available_from_date: '2026-09-01',
    }
    render(<ProfileWizard step={3} profile={profile as never} />)
    expect(screen.getByLabelText(/available from/i)).toHaveValue('2026-09-01')
  })

  // The seeking_type enum only holds the 10 NIL discovery values (§3A.6,
  // migration 20260616000001). Step 3 used to render five legacy chips
  // (endorsement, sponsorship, ambassador…) that are not in the enum, so any
  // selection made the whole PATCH fail with "We could not save those details".
  // Seeking is chosen in step 6; step 3 must not touch it at all.
  it('step 3: does not render the legacy seeking chips', () => {
    render(<ProfileWizard step={3} profile={null} />)
    expect(screen.queryByText(/i am seeking/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^endorsement$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^sponsorship$/i })).toBeNull()
  })

  it('step 3: the PATCH payload never contains seeking', async () => {
    render(<ProfileWizard step={3} profile={null} />)
    await userEvent.click(screen.getByRole('combobox', { name: /availability/i }))
    await userEvent.click(await screen.findByRole('option', { name: /^Available Now$/ }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as Record<string, unknown>
    expect(body).not.toHaveProperty('seeking')
    expect(body).toMatchObject({ availability_status: 'available_now' })
  })

  // §3A.4: the collapsed trigger must show the human label, never the raw enum
  // value — base-ui's Select.Value renders the raw value unless the root gets
  // an items map.
  it('step 3: the trigger shows the human label for a saved status', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft',
      availability_status: 'available_now',
    }
    render(<ProfileWizard step={3} profile={profile as never} />)
    const trigger = screen.getByRole('combobox', { name: /availability/i })
    expect(trigger).toHaveTextContent('Available Now')
    expect(trigger).not.toHaveTextContent(/available_now/)
  })

  // Step 4 socials accept @handle, bare handle or URL; the canonical bare
  // handle is what gets stored in social_accounts (lib/social/handles.ts).
  it('step 4: accepts @handle and URL inputs and stores canonical bare handles', async () => {
    render(<ProfileWizard step={4} profile={null} />)
    await userEvent.type(screen.getByLabelText('Instagram'), '@jane')
    await userEvent.type(screen.getByLabelText('TikTok'), 'https://tiktok.com/@bob')
    await userEvent.type(screen.getByLabelText('YouTube'), 'jane')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      social_accounts?: Record<string, unknown>
    }
    expect(body.social_accounts).toMatchObject({
      instagram: 'jane',
      tiktok: 'bob',
      youtube: 'jane',
    })
    expect(body.social_accounts).not.toHaveProperty('twitter')
  }, 15000)

  it('step 4: rejects a wrong-host URL with a validation message and no save', async () => {
    render(<ProfileWizard step={4} profile={null} />)
    await userEvent.type(screen.getByLabelText('Instagram'), 'https://facebook.com/jane')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(
      await screen.findByText(/enter a handle like @yourname/i),
    ).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  }, 15000)

  it('step 4: pre-fills stored legacy URLs as @handles', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft',
      social_accounts: { instagram: 'https://instagram.com/jane', twitter: 'bob' },
    }
    render(<ProfileWizard step={4} profile={profile as never} />)
    expect(screen.getByLabelText('Instagram')).toHaveValue('@jane')
    expect(screen.getByLabelText('X / Twitter')).toHaveValue('@bob')
  })

  it('step 4: preserves self-reported follower keys when re-saving socials', async () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft',
      social_accounts: { instagram: 'jane', instagram_followers: 12400 },
    }
    render(<ProfileWizard step={4} profile={profile as never} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      social_accounts?: Record<string, unknown>
    }
    expect(body.social_accounts).toMatchObject({ instagram: 'jane', instagram_followers: 12400 })
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

  // spec §3A.6: Discovery Interests — 10 NIL options as a multi-select
  // CardSelectGroup with subtitles, persisted to seeking_type[].
  it('step 6: renders the NIL discovery interests as selectable cards with subtitles', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'professional' }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.getByRole('button', { name: /product gifting/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paid partnership/i })).toBeInTheDocument()
    // A subtitle is present on the cards.
    expect(screen.getByText(/free products in exchange/i)).toBeInTheDocument()
  })

  it('step 6: hides the University / NIL Collective option for non-University athletes', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'professional' }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.queryByRole('button', { name: /nil collective/i })).toBeNull()
  })

  it('step 6: shows the University / NIL Collective option only for University/BUCS athletes', () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'university_bucs' }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.getByRole('button', { name: /nil collective/i })).toBeInTheDocument()
  })

  it('step 6: multi-selecting discovery interests persists seeking_type[] to the API', async () => {
    const profile = { user_id: 'u1', is_under_18: false, status: 'draft', level: 'professional', seeking: [] }
    render(<ProfileWizard step={6} profile={profile as never} />)
    await userEvent.click(screen.getByRole('button', { name: /product gifting/i }))
    await userEvent.click(screen.getByRole('button', { name: /paid partnership/i }))
    await userEvent.click(screen.getByRole('button', { name: /save (interests|discovery)/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as { seeking?: string[] }
    expect(body.seeking).toEqual(expect.arrayContaining(['product_gifting', 'paid_partnership']))
  })

  it('step 6: pre-selects previously saved discovery interests', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, status: 'draft', level: 'professional',
      seeking: ['paid_partnership'],
    }
    render(<ProfileWizard step={6} profile={profile as never} />)
    expect(screen.getByRole('button', { name: /paid partnership/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
