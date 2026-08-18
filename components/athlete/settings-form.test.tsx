import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsForm from './settings-form'
import type { Database } from '@/types/database'

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
// Provide minimal shims so switch clicks dispatch in tests.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {} as unknown
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SettingsRow = Database['public']['Tables']['profile_settings']['Row']

// updateSettings (B9) is the persistence path for the Visibility & Discovery
// section. We assert the component calls it rather than hitting the DB.
const updateSettingsMock = vi.fn()
const requestDataExportMock = vi.fn()
const getActiveSessionsMock = vi.fn()
const revokeSessionMock = vi.fn()
vi.mock('@/lib/supabase/settings', () => ({
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
  requestDataExport: (...args: unknown[]) => requestDataExportMock(...args),
  getActiveSessions: (...args: unknown[]) => getActiveSessionsMock(...args),
  revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ __browser: true }),
}))

const makeProfile = (overrides: Partial<AthleteRow> = {}): AthleteRow => ({
  id: 'p1',
  user_id: 'u1',
  display_name: 'James',
  full_legal_name: null,
  date_of_birth: null,
  phone: null,
  home_city: 'London',
  home_country: 'UK',
  primary_sport: 'Football',
  secondary_sport: null,
  level: 'amateur',
  position: null,
  years_active: null,
  height_cm: null,
  weight_kg: null,
  availability_status: 'available_now',
  available_from_date: null,
  travel_radius_km: 50,
  seeking: ['paid_partnership'],
  is_seeking: true,
  social_accounts: {},
  notable_achievements: null,
  is_under_18: false,
  has_agent: false,
  guardian_name: null,
  guardian_relationship: null,
  guardian_email: null,
  guardian_phone: null,
  guardian_accepted_at: null,
  profile_photo_url: null,
  notification_prefs: {},
  performance_stats: {},
  discovery_ui_mode: 'marketplace',
  display_theme: 'light',
  status: 'active',
  last_active_at: null,
  chat_retention_days: null,
  academy_club: null,
  action_photos: [],
  highest_level: null,
  highlight_videos: [],
  national_programme: null,
  university_team: null,
  university_city: null,
  university_country: null,
  payout_account_holder: null,
  payout_account_last4: null,
  payout_bank_name: null,
  payout_country: null,
  payout_method: null,
  payout_sort_code_last4: null,
  stripe_connect_account_id: null,
  stripe_connect_onboarded_at: null,
  stripe_connect_status: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
})

const makeSettings = (overrides: Partial<SettingsRow> = {}): SettingsRow => ({
  id: 's1',
  user_id: 'u1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  discoverable: true,
  profile_visible: true,
  pause_matches: false,
  display_currency: 'gbp',
  email_digest: 'weekly',
  location_precision: 'city',
  marketing_opt_in: false,
  notification_matrix: {},
  quiet_hours_start: null,
  quiet_hours_end: null,
  section_visibility: {},
  ...overrides,
})

describe('SettingsForm', () => {
  beforeEach(() => {
    updateSettingsMock.mockReset()
    updateSettingsMock.mockResolvedValue(makeSettings())
    requestDataExportMock.mockReset()
    requestDataExportMock.mockResolvedValue({ id: 'ex1', status: 'pending' })
    getActiveSessionsMock.mockReset()
    getActiveSessionsMock.mockResolvedValue([])
    revokeSessionMock.mockReset()
    revokeSessionMock.mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeProfile() }),
    )
  })

  // --- Section 1: Profile ---

  it('renders the two settings sections in a shell', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByRole('navigation', { name: /settings sections/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /visibility & discovery/i }),
    ).toBeInTheDocument()
  })

  it('renders display name field pre-populated', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByDisplayValue('James')).toBeInTheDocument()
  })

  it('shows a profile-completeness meter with a prompt for missing fields', () => {
    render(
      <SettingsForm
        profile={makeProfile({ profile_photo_url: null, notable_achievements: null })}
        settings={makeSettings()}
      />,
    )
    const meter = screen.getByRole('progressbar', { name: /profile completeness/i })
    expect(meter).toBeInTheDocument()
    // a prompt nudging the user to add the missing photo
    expect(screen.getByText(/add a profile photo/i)).toBeInTheDocument()
  })

  it('saves Section 1 profile fields via PATCH /api/profiles/me', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    await userEvent.clear(screen.getByLabelText(/display name/i))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Jimmy')
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/profiles/me',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  }, 15000) // interaction-heavy (clear + per-char type); extend timeout for full-suite parallel load

  // --- Section 2: Visibility & Discovery ---

  it('shows an explanation under the visibility toggle', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByText(/visible in discovery/i)).toBeInTheDocument()
  })

  it('persists the visibility toggle via updateSettings (B9)', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings({ profile_visible: true })} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const toggle = within(region).getByRole('switch', { name: /profile visible/i })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({ profile_visible: false }),
      ),
    )
  })

  it('persists the pause-matches toggle via updateSettings (B9)', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings({ pause_matches: false })} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const toggle = within(region).getByRole('switch', { name: /pause matches/i })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({ pause_matches: true }),
      ),
    )
  })

  it('saves discovery profile fields (travel radius / mode) via PATCH /api/profiles/me', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    // SET5 — Save is gated on a dirty section, so make an edit first.
    fireEvent.click(within(region).getByRole('switch', { name: /swipe mode/i }))
    await userEvent.click(within(region).getByRole('button', { name: /save discovery/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/profiles/me',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  it('reveals an availability date picker only when "Available From" is chosen', async () => {
    render(
      <SettingsForm
        profile={makeProfile({ availability_status: 'available_now' })}
        settings={makeSettings()}
      />,
    )
    expect(screen.queryByLabelText(/available from date/i)).not.toBeInTheDocument()
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    const availabilitySelect = within(region).getByLabelText(/availability/i)
    await userEvent.selectOptions(availabilitySelect, 'available_from')
    expect(screen.getByLabelText(/available from date/i)).toBeInTheDocument()
  })

  // --- Section 3: Notifications ---

  it('renders a notifications section with a Push/In-App/Email matrix', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /notifications/i })
    expect(within(region).getByRole('columnheader', { name: /push/i })).toBeInTheDocument()
    expect(within(region).getByRole('columnheader', { name: /in-app/i })).toBeInTheDocument()
    expect(within(region).getByRole('columnheader', { name: /email/i })).toBeInTheDocument()
    // a known event row
    expect(within(region).getByText(/new match/i)).toBeInTheDocument()
  })

  it('writes the notification matrix as jsonb via updateSettings when a channel is toggled', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /notifications/i })
    const toggle = within(region).getByRole('switch', {
      name: /new match.*push/i,
    })
    fireEvent.click(toggle)
    await userEvent.click(within(region).getByRole('button', { name: /save notifications/i }))
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({
          notification_matrix: expect.objectContaining({
            new_match: expect.objectContaining({ push: true }),
          }),
        }),
      ),
    )
  })

  it('persists quiet hours, digest and marketing opt-in via updateSettings', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /notifications/i })
    fireEvent.change(within(region).getByLabelText(/quiet hours start/i), {
      target: { value: '22:00' },
    })
    await userEvent.selectOptions(within(region).getByLabelText(/email digest/i), 'daily')
    fireEvent.click(within(region).getByRole('switch', { name: /marketing/i }))
    await userEvent.click(within(region).getByRole('button', { name: /save notifications/i }))
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({
          quiet_hours_start: '22:00',
          email_digest: 'daily',
          marketing_opt_in: true,
        }),
      ),
    )
  })

  // --- Section 4: Privacy & Data ---

  it('renders a privacy & data section with who-can-see and location precision', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /privacy & data/i })
    expect(within(region).getByLabelText(/location precision/i)).toBeInTheDocument()
    expect(within(region).getByText(/who can see/i)).toBeInTheDocument()
  })

  it('persists section visibility and location precision via updateSettings', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /privacy & data/i })
    await userEvent.selectOptions(
      within(region).getByLabelText(/location precision/i),
      'country',
    )
    fireEvent.click(within(region).getByRole('switch', { name: /performance stats/i }))
    await userEvent.click(within(region).getByRole('button', { name: /save privacy/i }))
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({
          location_precision: 'country',
          section_visibility: expect.objectContaining({ performance_stats: false }),
        }),
      ),
    )
  })

  it('creates a data-export request when Download My Data is clicked', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /privacy & data/i })
    await userEvent.click(
      within(region).getByRole('button', { name: /download my data/i }),
    )
    await waitFor(() =>
      expect(requestDataExportMock).toHaveBeenCalledWith(expect.anything(), 'u1'),
    )
  })

  it('lists blocked users from props and shows a data-processing summary', () => {
    render(
      <SettingsForm
        profile={makeProfile()}
        settings={makeSettings()}
        blockedUsers={[{ id: 'b1', name: 'Spam Brand' }]}
      />,
    )
    const region = screen.getByRole('region', { name: /privacy & data/i })
    expect(within(region).getByText(/spam brand/i)).toBeInTheDocument()
    expect(within(region).getByText(/how we use your data/i)).toBeInTheDocument()
  })

  // --- Section 5: Payments & Financial ---

  it('renders payment history with a receipt link and a pending row', () => {
    render(
      <SettingsForm
        profile={makeProfile()}
        settings={makeSettings()}
        payments={[
          {
            id: 'pay1',
            amount: 25000,
            currency: 'gbp',
            status: 'succeeded',
            receipt_url: 'https://receipts.test/pay1.pdf',
            created_at: '2026-05-01',
            counterparty: 'Acme Sports',
          },
          {
            id: 'pay2',
            amount: 10000,
            currency: 'gbp',
            status: 'pending',
            receipt_url: null,
            created_at: '2026-06-01',
            counterparty: 'Beta Brand',
          },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: /payments & financial/i })
    expect(within(region).getByText(/acme sports/i)).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: /receipt/i })).toHaveAttribute(
      'href',
      'https://receipts.test/pay1.pdf',
    )
    expect(within(region).getByText(/pending/i)).toBeInTheDocument()
  })

  it('shows Stripe Connect status and payout bank details', () => {
    render(
      <SettingsForm
        profile={makeProfile({
          stripe_connect_status: 'active',
          payout_method: 'bank_transfer',
          payout_bank_name: 'Test Bank',
          payout_account_last4: '4242',
        })}
        settings={makeSettings()}
      />,
    )
    const region = screen.getByRole('region', { name: /payments & financial/i })
    expect(within(region).getByText(/test bank/i)).toBeInTheDocument()
    expect(within(region).getByText(/4242/)).toBeInTheDocument()
    expect(within(region).getByText(/active/i)).toBeInTheDocument()
  })

  it('persists the display currency via updateSettings', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings({ display_currency: 'gbp' })} />)
    const region = screen.getByRole('region', { name: /payments & financial/i })
    await userEvent.selectOptions(within(region).getByLabelText(/display currency/i), 'usd')
    await userEvent.click(within(region).getByRole('button', { name: /save payment/i }))
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        expect.objectContaining({ display_currency: 'usd' }),
      ),
    )
  })

  // --- Section 6: Representation ---

  it('lists a linked agent and revokes the link after confirmation', async () => {
    const onRevokeAgent = vi.fn()
    render(
      <SettingsForm
        profile={makeProfile({ has_agent: true })}
        settings={makeSettings()}
        linkedAgents={[
          { id: 'lnk1', agentName: 'Star Agency', permissions: { negotiate: true, view_messages: false } },
        ]}
        onRevokeAgent={onRevokeAgent}
      />,
    )
    const region = screen.getByRole('region', { name: /representation/i })
    expect(within(region).getAllByText(/star agency/i).length).toBeGreaterThan(0)
    await userEvent.click(within(region).getByRole('button', { name: /^revoke$/i }))
    // confirmation step required before the callback fires
    expect(onRevokeAgent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /confirm revoke/i }))
    await waitFor(() => expect(onRevokeAgent).toHaveBeenCalledWith('lnk1'))
  })

  it('toggles a per-link permission via callback', async () => {
    const onAgentPermissionChange = vi.fn()
    render(
      <SettingsForm
        profile={makeProfile({ has_agent: true })}
        settings={makeSettings()}
        linkedAgents={[
          { id: 'lnk1', agentName: 'Star Agency', permissions: { negotiate: false, view_messages: false } },
        ]}
        onAgentPermissionChange={onAgentPermissionChange}
      />,
    )
    const region = screen.getByRole('region', { name: /representation/i })
    fireEvent.click(within(region).getByRole('switch', { name: /negotiate/i }))
    await waitFor(() =>
      expect(onAgentPermissionChange).toHaveBeenCalledWith('lnk1', 'negotiate', true),
    )
  })

  it('shows guardian details for under-18 athletes', () => {
    render(
      <SettingsForm
        profile={makeProfile({
          is_under_18: true,
          guardian_name: 'Pat Carer',
          guardian_relationship: 'Parent',
          guardian_email: 'pat@example.com',
        })}
        settings={makeSettings()}
      />,
    )
    const region = screen.getByRole('region', { name: /representation/i })
    expect(within(region).getByText(/pat carer · parent/i)).toBeInTheDocument()
    expect(within(region).getByText(/pat@example\.com/i)).toBeInTheDocument()
  })

  // --- Section 7: Security ---

  it('renders change-email and change-password controls', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /security/i })
    expect(within(region).getByLabelText(/new email/i)).toBeInTheDocument()
    // Exact match — "New password" must not also collide with "Confirm new password".
    expect(within(region).getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(within(region).getByLabelText(/current password/i)).toBeInTheDocument()
    expect(within(region).getByLabelText(/confirm new password/i)).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: /update email/i })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('reveals a 2FA QR setup when enabling two-factor', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /security/i })
    expect(within(region).queryByRole('img', { name: /2fa qr/i })).not.toBeInTheDocument()
    await userEvent.click(within(region).getByRole('button', { name: /set up two-factor/i }))
    expect(within(region).getByRole('img', { name: /2fa qr/i })).toBeInTheDocument()
  })

  it('loads active sessions and signs one out via revokeSession (B9)', async () => {
    getActiveSessionsMock.mockResolvedValue([
      {
        id: 'sess1',
        device_label: 'Chrome on Mac',
        ip_address: '1.2.3.4',
        last_active_at: '2026-06-10T12:00:00Z',
      },
    ])
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /security/i })
    await waitFor(() =>
      expect(within(region).getByText(/chrome on mac/i)).toBeInTheDocument(),
    )
    await userEvent.click(within(region).getByRole('button', { name: /sign out/i }))
    await waitFor(() =>
      expect(revokeSessionMock).toHaveBeenCalledWith(expect.anything(), 'sess1'),
    )
  })

  it('renders login history rows from props', () => {
    render(
      <SettingsForm
        profile={makeProfile()}
        settings={makeSettings()}
        loginHistory={[
          { id: 'lh1', success: true, location: 'London, UK', created_at: '2026-06-15T09:00:00Z' },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: /security/i })
    expect(within(region).getByText(/london, uk/i)).toBeInTheDocument()
  })

  // --- Section 8: Account ---

  it('toggles account deactivation via callback', async () => {
    const onDeactivateChange = vi.fn()
    render(
      <SettingsForm
        profile={makeProfile({ status: 'active' })}
        settings={makeSettings()}
        onDeactivateChange={onDeactivateChange}
      />,
    )
    const region = screen.getByRole('region', { name: /account/i })
    fireEvent.click(within(region).getByRole('switch', { name: /deactivate account/i }))
    await waitFor(() => expect(onDeactivateChange).toHaveBeenCalledWith(true))
  })

  it('requires typing DELETE before account deletion is enabled, then shows a 14-day grace summary', async () => {
    const onDeleteAccount = vi.fn()
    render(
      <SettingsForm
        profile={makeProfile()}
        settings={makeSettings()}
        onDeleteAccount={onDeleteAccount}
      />,
    )
    const region = screen.getByRole('region', { name: /account/i })
    expect(within(region).getByText(/14[- ]day/i)).toBeInTheDocument()
    const confirmBtn = within(region).getByRole('button', { name: /delete my account/i })
    expect(confirmBtn).toBeDisabled()
    await userEvent.type(within(region).getByLabelText(/type delete/i), 'DELETE')
    expect(confirmBtn).toBeEnabled()
    await userEvent.click(confirmBtn)
    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalled())
  })

  // --- Onboarding-to-settings parity (Section 1) ---

  function lastPatchBody(): Record<string, unknown> {
    const mockFetch = fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]!
    return JSON.parse(call[1].body) as Record<string, unknown>
  }

  it('renders the full legal name locked with support helper text', () => {
    render(
      <SettingsForm
        profile={makeProfile({ full_legal_name: 'James Alexander Smith' })}
        settings={makeSettings()}
      />,
    )
    const input = screen.getByLabelText(/full legal name/i)
    expect(input).toBeDisabled()
    expect(input).toHaveValue('James Alexander Smith')
    expect(
      screen.getByText(/locked\. contact support to change your legal name/i),
    ).toBeInTheDocument()
  })

  it('saves the onboarding-parity fields in the profile PATCH body', async () => {
    render(
      <SettingsForm
        profile={makeProfile({
          secondary_sport: 'Athletics',
          position: 'Striker',
          years_active: 4,
          height_cm: 180,
          weight_kg: 75,
          date_of_birth: '1998-05-12',
          phone: '+44 7700 900000',
          home_city: 'London',
        })}
        settings={makeSettings()}
      />,
    )
    // SET3 — sport is now a constrained combobox (not free text), so drive a
    // free-text field to dirty the section; the parity payload still flows.
    fireEvent.change(screen.getByLabelText(/position/i), {
      target: { value: 'Winger' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(lastPatchBody()).toMatchObject({
      secondary_sport: 'Athletics',
      position: 'Winger',
      years_active: 4,
      height_cm: 180,
      weight_kg: 75,
      date_of_birth: '1998-05-12',
      phone: '+44 7700 900000',
      home_city: 'London',
    })
  })

  it('shows the university fields only for University/BUCS athletes', () => {
    const { unmount } = render(
      <SettingsForm profile={makeProfile({ level: 'university_bucs' })} settings={makeSettings()} />,
    )
    expect(screen.getByLabelText(/university team/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/university city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/university country/i)).toBeInTheDocument()
    unmount()

    render(<SettingsForm profile={makeProfile({ level: 'amateur' })} settings={makeSettings()} />)
    expect(screen.queryByLabelText(/university team/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/university city/i)).not.toBeInTheDocument()
  })

  it('shows academy and national fields for their levels only', () => {
    const { unmount } = render(
      <SettingsForm profile={makeProfile({ level: 'academy' })} settings={makeSettings()} />,
    )
    expect(screen.getByLabelText(/academy \/ club/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/national programme/i)).not.toBeInTheDocument()
    unmount()

    render(<SettingsForm profile={makeProfile({ level: 'national' })} settings={makeSettings()} />)
    expect(screen.getByLabelText(/national programme/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/academy \/ club/i)).not.toBeInTheDocument()
  })

  // --- Socials: canonical handles + self-reported follower counts ---

  it('canonicalises social inputs to bare handles in social_accounts', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@jane' } })
    fireEvent.change(screen.getByLabelText('TikTok'), {
      target: { value: 'https://tiktok.com/@bob' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const body = lastPatchBody()
    expect(body.social_accounts).toMatchObject({ instagram: 'jane', tiktok: 'bob' })
  })

  it('writes self-reported follower counts to the canonical numeric keys, stripping commas', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@jane' } })
    fireEvent.change(screen.getByLabelText(/instagram followers/i), {
      target: { value: '12,400' },
    })
    fireEvent.change(screen.getByLabelText('YouTube'), { target: { value: '@jane' } })
    fireEvent.change(screen.getByLabelText(/youtube subscribers/i), {
      target: { value: '3200' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const body = lastPatchBody()
    expect(body.social_accounts).toMatchObject({
      instagram_followers: 12400,
      youtube_subscribers: 3200,
    })
    // Follower inputs are clearly labelled as self-reported.
    expect(
      screen.getAllByText(/self-reported\. shown on your profile/i).length,
    ).toBeGreaterThan(0)
  })

  it('rejects an invalid social input and does not save', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    fireEvent.change(screen.getByLabelText('Instagram'), {
      target: { value: 'https://facebook.com/jane' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    expect(fetch).not.toHaveBeenCalled()
  })

  // --- Seeking opportunities toggle (is_seeking) ---

  it('persists the seeking toggle via the discovery PATCH', async () => {
    render(<SettingsForm profile={makeProfile({ is_seeking: true })} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /visibility & discovery/i })
    fireEvent.click(within(region).getByRole('switch', { name: /seeking opportunities/i }))
    await userEvent.click(within(region).getByRole('button', { name: /save discovery/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(lastPatchBody()).toMatchObject({ is_seeking: false })
  })

  // --- Payout copy: optional framing, not a broken setup ---

  it('frames an unstarted payout setup as optional, with no double negative', () => {
    render(
      <SettingsForm
        profile={makeProfile({ stripe_connect_status: null, payout_method: null })}
        settings={makeSettings()}
      />,
    )
    const region = screen.getByRole('region', { name: /payments & financial/i })
    expect(
      within(region).getByText(/payouts are optional until you agree a paid deal/i),
    ).toBeInTheDocument()
    expect(within(region).queryByText(/no payout method set up yet/i)).not.toBeInTheDocument()
    expect(within(region).queryByText(/not started/i)).not.toBeInTheDocument()
    // The status chip is hidden entirely until setup begins.
    expect(within(region).queryByText(/stripe connect:/i)).not.toBeInTheDocument()
  })

  it('shows an under-18 transition banner when the athlete is a minor', () => {
    render(
      <SettingsForm
        profile={makeProfile({ is_under_18: true, date_of_birth: '2009-06-17' })}
        settings={makeSettings()}
      />,
    )
    const region = screen.getByRole('region', { name: /account/i })
    expect(within(region).getByText(/turn 18/i)).toBeInTheDocument()
  })

  // --- SET5: per-section dirty tracking ---

  it('enables Save profile only once the section is edited', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const save = screen.getByRole('button', { name: /save profile/i })
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/display name/i), '!')
    expect(save).toBeEnabled()
    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)
  })

  // --- SET3: constrained sport, junk values preserved not dropped ---

  it('keeps an out-of-vocabulary secondary sport rather than silently dropping it', async () => {
    render(
      <SettingsForm
        profile={makeProfile({ secondary_sport: 'Gay' })}
        settings={makeSettings()}
      />,
    )
    // Dirty a free-text field so the section can be saved.
    fireEvent.change(screen.getByLabelText(/position/i), { target: { value: 'Winger' } })
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(lastPatchBody()).toMatchObject({ secondary_sport: 'Gay' })
  })

  it('renders labelled primary and secondary sport controls', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByLabelText('Primary sport')).toBeInTheDocument()
    expect(screen.getByLabelText('Secondary sport')).toBeInTheDocument()
  })

  // --- SET6: single discoverability control ---

  it('does not expose a second discoverability switch in Privacy & Data', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    const region = screen.getByRole('region', { name: /privacy & data/i })
    expect(
      within(region).queryByRole('switch', { name: /discoverable by brands/i }),
    ).not.toBeInTheDocument()
    // The single control lives in Visibility & Discovery.
    const visibility = screen.getByRole('region', { name: /visibility & discovery/i })
    expect(within(visibility).getByRole('switch', { name: /profile visible/i })).toBeInTheDocument()
  })

  // --- SET2/SET4: security update controls ---

  it('sets new-password autocomplete on the password fields (SET4)', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('blocks a password update when confirmation does not match, with an alert', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    await userEvent.type(screen.getByLabelText(/current password/i), 'Old-pass1!')
    await userEvent.type(screen.getByLabelText(/^new password/i), 'New-pass1!')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Different1!')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i)
    expect(fetch).not.toHaveBeenCalled()
  }, 15000)

  it('posts a valid password change to the password-update route', async () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} />)
    await userEvent.type(screen.getByLabelText(/current password/i), 'Old-pass1!')
    await userEvent.type(screen.getByLabelText(/^new password/i), 'New-pass1!')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'New-pass1!')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/password-update',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  }, 15000)

  // --- SET13: dead-end empty states now carry a CTA ---

  it('offers a payout setup CTA when no payout method exists', () => {
    render(
      <SettingsForm
        profile={makeProfile({ payout_method: null, stripe_connect_status: null })}
        settings={makeSettings()}
      />,
    )
    const region = screen.getByRole('region', { name: /payments & financial/i })
    expect(within(region).getByRole('button', { name: /set up payouts/i })).toBeInTheDocument()
  })

  it('offers an invite-an-agent CTA when no agent is linked', () => {
    render(<SettingsForm profile={makeProfile()} settings={makeSettings()} linkedAgents={[]} />)
    const region = screen.getByRole('region', { name: /representation/i })
    expect(within(region).getByRole('button', { name: /invite an agent/i })).toBeInTheDocument()
  })
})
